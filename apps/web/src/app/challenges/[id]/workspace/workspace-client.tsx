"use client";

import type { ChallengeSpec } from "@prompt-race/shared";

export function WorkspaceClient({ challenge }: { challenge: ChallengeSpec }) {
  return (
    <p style={{ color: "var(--muted)" }}>
      Workspace for <code>{challenge.id}</code> — prompt UI lands in Step 3.
    </p>
  );
}