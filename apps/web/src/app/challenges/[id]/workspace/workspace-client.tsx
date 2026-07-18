
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeSpec } from "@prompt-race/shared";
import type { FeedItem } from "@/lib/workspace-types";

function nowIso() {
  return new Date().toISOString();
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
      const response = await fetch(`/api/attempts/${attemptId}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = (await response.json()) as {
        blocked?: boolean;
        reason?: string;
        assistantMessage?: string;
        filesTouched?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Prompt could not be processed.");
      if (data.blocked) {
        pushFeed({ kind: "guard", text: `Blocked: ${data.reason ?? "Out of scope."}` });
        return;
      }
      pushFeed({ kind: "guard", text: "Allowed by scope guard." });
      pushFeed({
        kind: "builder",
        text: data.assistantMessage ?? "Builder completed without a message.",
        filesTouched: data.filesTouched ?? [],
      });
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
