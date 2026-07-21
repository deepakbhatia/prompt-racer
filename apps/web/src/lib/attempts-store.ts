import type { EvaluationResult, PostRunAnalysis, RaceAttempt, RunResult } from "@prompt-race/shared";
import { getAttemptRepository, type StoredToolEvent } from "./attempt-repository";

// Compatibility facade while routes migrate to the repository interface.
export const saveAttempt = (attempt: RaceAttempt) => getAttemptRepository().create(attempt);
export const getAttempt = (id: string) => getAttemptRepository().get(id);
export const updateAttempt = (id: string, patch: Partial<RaceAttempt>) => getAttemptRepository().update(id, patch);
export const submitAttempt = (id: string) => getAttemptRepository().submit(id);
export const appendToolEvent = (id: string, event: Omit<StoredToolEvent, "sequence" | "at">) =>
  getAttemptRepository().appendToolEvent(id, event);
export const saveRun = (result: RunResult) => getAttemptRepository().saveRun(result);
export const saveEvaluation = (id: string, result: EvaluationResult) => getAttemptRepository().saveEvaluation(id, result);
export const savePostRunAnalysis = (id: string, analysis: PostRunAnalysis) =>
  getAttemptRepository().savePostRunAnalysis(id, analysis);
export const getToolEvents = (id: string) => getAttemptRepository().getToolEvents(id);
export const getRunResults = (id: string) => getAttemptRepository().getRunResults(id);
