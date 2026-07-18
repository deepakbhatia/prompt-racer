import type { RaceAttempt } from "@prompt-race/shared";

const attempts = new Map<string, RaceAttempt>();

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