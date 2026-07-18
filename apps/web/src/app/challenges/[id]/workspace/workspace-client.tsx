
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeSpec } from "@prompt-race/shared";
import type { FeedItem } from "@/lib/workspace-types";

function nowIso() {
  return new Date().toISOString();
}

type StreamEvent =
  | { type: "guard"; allowed: boolean }
  | { type: "delta"; text: string }
  | { type: "done"; assistantMessage: string }
  | { type: "error"; message: string };

function parseSseRecords(buffer: string) {
  const records = buffer.split("\n\n");
  return { records: records.slice(0, -1), remainder: records.at(-1) ?? "" };
}

export function WorkspaceClient({ challenge }: { challenge: ChallengeSpec }) {
  const [prompt, setPrompt] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStartedAttempt = useRef(false);

  function pushFeed(item: Omit<FeedItem, "id" | "at">) {
    setFeed((prev) => [
      ...prev,
      { ...item, id: crypto.randomUUID(), at: nowIso() },
    ]);
  }

  useEffect(() => {
    if (hasStartedAttempt.current) return;
    hasStartedAttempt.current = true;

    async function startAttempt() {
      try {
        const response = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: challenge.id }),
        });
        const data = (await response.json()) as { attempt?: { id: string }; error?: string };
        if (!response.ok || !data.attempt) {
          throw new Error(data.error ?? "Could not create an attempt.");
        }
        setAttemptId(data.attempt.id);
        pushFeed({ kind: "system", text: `Attempt ${data.attempt.id} ready.` });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not create an attempt.");
      }
    }

    void startAttempt();
  }, [challenge.id]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || !attemptId || pending) return;

    setPrompt("");
    setPending(true);
    setError(null);
    pushFeed({ kind: "user", text });

    try {
      const response = await fetch(`/api/attempts/${attemptId}/prompt/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
        };
        throw new Error(data.error ?? data.reason ?? "Prompt could not be processed.");
      }
      if (!response.headers.get("content-type")?.includes("text/event-stream")) {
        const data = (await response.json()) as { blocked?: boolean; reason?: string; error?: string };
        if (data.blocked) {
          pushFeed({ kind: "guard", text: `Blocked: ${data.reason ?? "Out of scope."}` });
          return;
        }
        throw new Error(data.error ?? "The server returned an unexpected response.");
      }
      if (!response.body) throw new Error("The server did not return a stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedDone = false;
      let builderItemId: string | null = null;
      let builderText = "";

      const handleEvent = (event: StreamEvent) => {
        if (event.type === "guard") {
          pushFeed({
            kind: "guard",
            text: event.allowed ? "Allowed by scope guard." : "Blocked by scope guard.",
          });
          return;
        }
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "delta") {
          builderText += event.text;
          if (!builderItemId) {
            const id = crypto.randomUUID();
            builderItemId = id;
            setFeed((items) => [
              ...items,
              { id, kind: "builder", text: builderText, at: nowIso() },
            ]);
            return;
          }
          setFeed((items) =>
            items.map((item) =>
              item.id === builderItemId ? { ...item, text: builderText } : item,
            ),
          );
          return;
        }
        receivedDone = true;
        if (!builderItemId) {
          pushFeed({ kind: "builder", text: event.assistantMessage });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const parsed = parseSseRecords(buffer);
        buffer = parsed.remainder;

        for (const record of parsed.records) {
          const data = record
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice("data:".length).trimStart())
            .join("\n");
          if (data) handleEvent(JSON.parse(data) as StreamEvent);
        }
        if (done) break;
      }

      if (!receivedDone) throw new Error("The builder stream ended unexpectedly.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Prompt could not be processed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="workspace">
      <form className="prompt-form" onSubmit={onSubmit}>
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to build…"
          disabled={pending || !attemptId}
        />
        <button type="submit" disabled={pending || !attemptId || !prompt.trim()}>
          {pending ? "Working…" : attemptId ? "Send prompt" : "Preparing sandbox…"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <ol className="activity-feed">
        {feed.length === 0 && (
          <li className="feed-empty">No activity yet. Send a prompt.</li>
        )}
        {feed.map((item) => (
          <li key={item.id} className={`feed-item feed-item--${item.kind}`}>
            <span className="feed-item__kind">{item.kind}</span>
            <p>{item.text}</p>
            {item.filesTouched && item.filesTouched.length > 0 && (
              <p className="feed-item__files">
                Files: {item.filesTouched.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
