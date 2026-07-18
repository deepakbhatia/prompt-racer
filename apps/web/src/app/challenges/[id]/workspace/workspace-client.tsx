
"use client";

import { useState, useTransition } from "react";
import type { ChallengeSpec, PromptTurn } from "@prompt-race/shared";
import { createStubAgents } from "@prompt-race/agent";
import type { FeedItem } from "@/lib/workspace-types";

const agents = createStubAgents();

function nowIso() {
  return new Date().toISOString();
}

export function WorkspaceClient({ challenge }: { challenge: ChallengeSpec }) {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<PromptTurn[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pending, startTransition] = useTransition();

  function pushFeed(item: Omit<FeedItem, "id" | "at">) {
    setFeed((prev) => [
      ...prev,
      { ...item, id: crypto.randomUUID(), at: nowIso() },
    ]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || pending) return;

    setPrompt("");
    pushFeed({ kind: "user", text });

    startTransition(async () => {
      const verdict = await agents.scopeGuard(challenge, text);
      if (!verdict.allowed) {
        pushFeed({ kind: "guard", text: `Blocked: ${verdict.reason}` });
        return;
      }
      pushFeed({ kind: "guard", text: "Allowed by scope guard." });

      const result = await agents.builder(
        challenge,
        history,
        verdict.sanitizedPrompt ?? text,
        /* sandboxPath */ "",
      );

      const userTurn: PromptTurn = {
        index: history.length,
        role: "user",
        content: text,
        at: nowIso(),
      };
      const assistantTurn: PromptTurn = {
        index: history.length + 1,
        role: "assistant",
        content: result.assistantMessage,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        at: nowIso(),
      };

      setHistory((h) => [...h, userTurn, assistantTurn]);
      pushFeed({
        kind: "builder",
        text: result.assistantMessage,
        filesTouched: result.filesTouched,
      });
    });
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
          disabled={pending}
        />
        <button type="submit" disabled={pending || !prompt.trim()}>
          {pending ? "Working…" : "Send prompt"}
        </button>
      </form>

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
