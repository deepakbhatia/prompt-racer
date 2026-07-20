
"use client";

import { useEffect, useRef, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import type { ChallengeSpec, RunResult } from "@prompt-race/shared";
import type { FeedItem } from "@/lib/workspace-types";

function nowIso() {
  return new Date().toISOString();
}

type StreamEvent =
  | { type: "guard"; allowed: boolean }
  | { type: "tool_start"; name: string; path?: string }
  | { type: "tool_end"; name: string; ok: boolean; path?: string; bytes?: number }
  | { type: "tool_error"; name: string; error: string }
  | { type: "delta"; text: string }
  | { type: "done"; assistantMessage: string; filesTouched?: string[] }
  | { type: "error"; message: string };

function parseSseRecords(buffer: string) {
  const records = buffer.split("\n\n");
  return { records: records.slice(0, -1), remainder: records.at(-1) ?? "" };
}

function languageForFile(filePath: string | null) {
  const extension = filePath?.split(".").at(-1)?.toLowerCase();
  switch (extension) {
    case "ts": return "typescript";
    case "tsx": return "tsx";
    case "js":
    case "mjs":
    case "cjs": return "javascript";
    case "json": return "json";
    case "html": return "markup";
    case "css": return "css";
    case "md": return "markdown";
    case "sh":
    case "bash": return "bash";
    default: return "plain";
  }
}

export function WorkspaceClient({ challenge }: { challenge: ChallengeSpec }) {
  const [prompt, setPrompt] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStartedAttempt = useRef(false);
  const language = languageForFile(selectedFile);
  const grammar = Prism.languages[language];
  const highlightedSource = source && grammar ? Prism.highlight(source, grammar, language) : null;

  function pushFeed(item: Omit<FeedItem, "id" | "at">) {
    setFeed((prev) => [
      ...prev,
      { ...item, id: crypto.randomUUID(), at: nowIso() },
    ]);
  }

  async function openFile(id: string, filePath: string) {
    setSelectedFile(filePath);
    setSource(null);
    try {
      const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`/api/attempts/${id}/files/${encodedPath}`);
      const data = (await response.json()) as { content?: string; error?: string };
      if (!response.ok || data.content === undefined) {
        throw new Error(data.error ?? "Could not read file.");
      }
      setSource(data.content);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read file.");
      setSource(null);
    }
  }

  async function refreshFiles(id: string, preferredFile?: string) {
    setLoadingFiles(true);
    try {
      const response = await fetch(`/api/attempts/${id}/files`);
      const data = (await response.json()) as { files?: string[]; error?: string };
      if (!response.ok || !data.files) throw new Error(data.error ?? "Could not load files.");
      setFiles(data.files);
      const nextFile =
        (preferredFile && data.files.includes(preferredFile) && preferredFile) ||
        (selectedFile && data.files.includes(selectedFile) && selectedFile) ||
        data.files[0] ||
        null;
      if (nextFile) await openFile(id, nextFile);
      else {
        setSelectedFile(null);
        setSource(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load files.");
    } finally {
      setLoadingFiles(false);
    }
  }

  async function runAttempt() {
    if (!attemptId || running) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/attempts/${attemptId}/run`, { method: "POST" });
      const data = (await response.json()) as RunResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Run failed.");
      setRunResult(data);
      pushFeed({ kind: "system", text: `Run finished with exit code ${data.exitCode}.` });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Run failed.");
    } finally {
      setRunning(false);
    }
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
        await refreshFiles(data.attempt.id);
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
        if (event.type === "tool_start") {
          pushFeed({
            kind: "system",
            text: `Using ${event.name}${event.path ? `: ${event.path}` : ""}`,
          });
          return;
        }
        if (event.type === "tool_end") {
          const details = [
            `${event.name} completed`,
            event.path,
            event.bytes === undefined ? undefined : `${event.bytes} bytes`,
          ].filter(Boolean).join(" · ");
          pushFeed({ kind: "system", text: details });
          return;
        }
        if (event.type === "tool_error") {
          pushFeed({ kind: "error", text: `${event.name} failed: ${event.error}` });
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
        if (attemptId) void refreshFiles(attemptId, event.filesTouched?.at(-1));
        if (!builderItemId) {
          pushFeed({
            kind: "builder",
            text: event.assistantMessage,
            filesTouched: event.filesTouched ?? [],
          });
          return;
        }
        setFeed((items) =>
          items.map((item) =>
            item.id === builderItemId
              ? { ...item, text: event.assistantMessage || item.text, filesTouched: event.filesTouched ?? [] }
              : item,
          ),
        );
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
      <section className="code-workspace" aria-label="Generated code">
        <aside className="file-browser">
          <div className="file-browser__header">
            <strong>Files</strong>
            <button type="button" onClick={() => attemptId && void refreshFiles(attemptId)} disabled={!attemptId || loadingFiles}>
              {loadingFiles ? "Loading…" : "Refresh"}
            </button>
          </div>
          {files.length === 0 ? (
            <p className="file-browser__empty">No generated files yet.</p>
          ) : (
            <ul>
              {files.map((filePath) => (
                <li key={filePath}>
                  <button
                    type="button"
                    className={filePath === selectedFile ? "is-selected" : undefined}
                    onClick={() => attemptId && void openFile(attemptId, filePath)}
                  >
                    {filePath}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="code-viewer" aria-live="polite">
          <div className="code-viewer__header">{selectedFile ?? "Select a file"}</div>
          <pre className={`language-${language}`}>
            {source === null ? (
              "Select a file to inspect its generated source."
            ) : highlightedSource ? (
              <code dangerouslySetInnerHTML={{ __html: highlightedSource }} />
            ) : (
              <code>{source}</code>
            )}
          </pre>
        </section>
      </section>

      <section className="run-panel" aria-label="Run output">
        <div className="run-panel__header">
          <strong>Output</strong>
          <button type="button" onClick={() => void runAttempt()} disabled={!attemptId || running}>
            {running ? "Running…" : "Run challenge"}
          </button>
        </div>
        {runResult ? (
          <>
            <p className="run-panel__status">Exit code: {runResult.exitCode}</p>
            <pre>{runResult.stdout || runResult.stderr || "Command completed without output."}</pre>
            {runResult.stdout && runResult.stderr && <pre className="run-panel__stderr">{runResult.stderr}</pre>}
          </>
        ) : (
          <p className="run-panel__empty">Run the challenge-owned command to inspect its output.</p>
        )}
      </section>

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
