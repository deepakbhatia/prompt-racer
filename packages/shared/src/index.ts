/** Shared domain types for races, prompts, and evaluation. */

export type RaceStatus = "lobby" | "live" | "scoring" | "finished";

export type AgentRole = "builder" | "scope_guard" | "evaluator" | "coach";

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
  /** Durable, storage-neutral sandbox identifier (for example `solo/<attemptId>`). */
  sandboxRef: string;
  /** Deterministic evidence captured when the attempt was submitted. */
  checkResults?: RunCheckResult[];
  /** Final, deterministic leaderboard result for a completed attempt. */
  evaluation?: EvaluationResult;
  /** Informational post-run guidance. It never influences scoring. */
  postRunAnalysis?: PostRunAnalysis;
  prompts: PromptTurn[];
  /** Ephemeral host path, resolved from sandboxRef by the server only. */
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

/** Informational coaching generated after deterministic scoring completes. */
export interface PostRunAnalysis {
  attemptId: string;
  summary: string;
  timeLosses: { promptTurn: number; issue: string; impact: "low" | "medium" | "high" }[];
  redundantPrompts: { promptTurn: number; reason: string }[];
  recommendations: string[];
  /** Aggregate-only observations; empty when no benchmark metrics exist. */
  topRunnerComparison: string[];
}

/** Output from a platform-owned command run for one attempt. */
export interface RunResult {
  attemptId: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  checks?: RunCheckResult[];
}

/** A normalized, deterministic result from a platform-owned acceptance probe. */
export interface RunCheckResult {
  id: string;
  passed: boolean;
  detail: string;
}

/**
 * Server-only runner configuration. This is never accepted from the browser or
 * included in a public ChallengeSpec.
 */
export type ChallengeRuntimeProfile =
  | {
      kind: "cli";
      image: "prompt-race/node-cli:22";
      command: ["npm", "run", string];
      timeoutMs: number;
    }
  | {
      kind: "http";
      image: "prompt-race/node-http:22";
      command: ["npm", "run", string];
      port: number;
      readiness: { path: string; expectedStatus: number };
      timeoutMs: number;
    }
  | {
      kind: "browser";
      image: "prompt-race/web-preview:22";
      command: ["npm", "run", string];
      port: number;
      readiness: { path: string; expectedStatus: number };
      timeoutMs: number;
    };

/** @deprecated Use ChallengeRuntimeProfile. */
export type RunProfile = Extract<ChallengeRuntimeProfile, { kind: "cli" }>;

export interface Race {
  id: string;
  challengeId: string;
  status: RaceStatus;
  contestantIds: string[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}
