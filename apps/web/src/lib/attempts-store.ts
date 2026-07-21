import type { RaceAttempt } from "@prompt-race/shared";

declare global {
  // Shared by separately bundled Next route handlers in one Node.js process.
  // Replace this development-only store with a database before deployment.
  var promptRaceAttempts: Map<string, RaceAttempt> | undefined;
}

const attempts = globalThis.promptRaceAttempts ?? new Map<string, RaceAttempt>();
globalThis.promptRaceAttempts = attempts;

export function saveAttempt(attempt: RaceAttempt) {
  attempts.set(attempt.id, attempt);
}

export function getAttempt(id: string) {
  return attempts.get(id);
}

export function updateAttempt(id: string, patch: Partial<RaceAttempt>) {
  const current = attempts.get(id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  attempts.set(id, next);
  return next;
}

/**
 * Local compare-and-set transition. A database implementation must perform the
 * equivalent conditional update in one transaction.
 */
export function submitAttempt(id: string) {
  const current = attempts.get(id);
  if (!current || current.status !== "running") return undefined;
  const submitted: RaceAttempt = {
    ...current,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  attempts.set(id, submitted);
  return submitted;
}
