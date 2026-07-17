/** Shared domain types for races, prompts, and evaluation. */

export type RaceStatus = "lobby" | "live" | "scoring" | "finished";

export type AgentRole = "builder" | "scope_guard" | "evaluator";

export interface ChallengeSpec {
  id: string;
  title: string;
  /** Public brief shown to contestants (natural-language only). */
  brief: string;
  /** Hard time limit in seconds. */
  timeLimitSec: number;
  /** Allowed stack hints (e.g. "static HTML", "Node HTTP server"). */
  allowedStack: string[];
  /** Paths contestants must not touch / request (enforced by scope guard). */
  outOfScope: string[];
  /** Acceptance criteria the evaluator checks against. */
  acceptance: string[];
}

export interface PromptTurn {
  index: number;
  role: "user" | "assistant";
  content: string;
  /** Tokens attributed to this turn (when available). */
  tokensIn?: number;
  tokensOut?: number;
  at: string; // ISO timestamp
}

export interface RaceAttempt {
  id: string;
  raceId: string;
  contestantId: string;
  challengeId: string;
  status: "running" | "submitted" | "passed" | "failed" | "disqualified";
  startedAt: string;
  submittedAt?: string;
  prompts: PromptTurn[];
  /** Working directory for this attempt (sandbox). */
  sandboxPath: string;
}

export interface EvaluationResult {
  attemptId: string;
  passed: boolean;
  /** 0–1 functional score from acceptance checks. */
  functionalScore: number;
  /** Wall-clock seconds from start to submit. */
  elapsedSec: number;
  /** Prompt efficiency: lower is better (tokens + turn count). */
  promptTokens: number;
  promptTurns: number;
  efficiencyScore: number;
  /** Composite leaderboard score (higher is better). */
  compositeScore: number;
  notes: string[];
  disqualificationReason?: string;
}

export interface Race {
  id: string;
  challengeId: string;
  status: RaceStatus;
  contestantIds: string[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}
