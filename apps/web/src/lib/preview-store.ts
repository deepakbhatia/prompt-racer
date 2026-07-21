import type { ManagedRun } from "./runner/types";

export interface PreviewSession {
  attemptId: string;
  previewUrl: string;
  expiresAt: string;
  run: ManagedRun;
}

declare global {
  var promptRacePreviews: Map<string, PreviewSession> | undefined;
}

const previews = globalThis.promptRacePreviews ?? new Map<string, PreviewSession>();
globalThis.promptRacePreviews = previews;

export function getPreview(attemptId: string) {
  const session = previews.get(attemptId);
  if (!session) return undefined;
  if (Date.parse(session.expiresAt) <= Date.now()) return undefined;
  return session;
}

export async function replacePreview(session: PreviewSession) {
  const previous = previews.get(session.attemptId);
  if (previous) await previous.run.stop();
  previews.set(session.attemptId, session);
}

export async function expirePreview(attemptId: string) {
  const session = previews.get(attemptId);
  if (!session) return;
  previews.delete(attemptId);
  await session.run.stop();
}
