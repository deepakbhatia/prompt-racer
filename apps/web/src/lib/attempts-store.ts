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
