/**
 * GPT-5.6 roles for Prompt Race:
 * - builder: turns contestant natural-language prompts into code in a sandbox
 * - scope_guard: rejects out-of-scope requests before they hit the builder
 * - evaluator: checks acceptance criteria + computes qualitative notes
 *
 * Wire OpenAI (or compatible) client here; keep secrets in env only.
 */

import type { AgentRole, ChallengeSpec, EvaluationResult, PostRunAnalysis, PromptTurn } from "@prompt-race/shared";
import type { BuilderToolEvent } from "./builder-loop";

export const DEFAULT_MODEL = "gpt-5.6";

export interface AgentClientOptions {
  apiKey: string;
  model?: string;
  /** Base URL override for compatible gateways. */
  baseUrl?: string;
}

export interface ScopeGuardVerdict {
  allowed: boolean;
  reason: string;
  /** Sanitized prompt if allowed with redactions; undefined if blocked. */
  sanitizedPrompt?: string;
}

export interface BuilderResult {
  assistantMessage: string;
  filesTouched: string[];
  tokensIn?: number;
  tokensOut?: number;
}

export interface BuilderOptions {
  onEvent?: (event: BuilderToolEvent) => void;
}

export interface EvaluatorInput {
  challenge: ChallengeSpec;
  prompts: PromptTurn[];
  sandboxPath: string;
  elapsedSec: number;
  /** Results from automated acceptance checks (tests / HTTP probes). */
  checkResults: { id: string; passed: boolean; detail: string }[];
}

export interface CoachInput {
  attemptId: string;
  challenge: ChallengeSpec;
  /** The contestant's own trace only; content is bounded by the caller. */
  prompts: Pick<PromptTurn, "index" | "role" | "content" | "tokensIn" | "tokensOut">[];
  toolEvents: { sequence: number; type: string; name: string; path?: string; bytes?: number; at: string }[];
  runs: { exitCode: number; durationMs: number; checks: { id: string; passed: boolean }[] }[];
  evaluatorNotes: string[];
  benchmarkSummary?: {
    successfulAttempts: number;
    medianPromptTurns: number;
    medianPromptTokens: number;
    firstWorkingRunMedianSec: number;
  };
}

/** Placeholder interfaces — implement against your LLM provider next. */
export interface PromptRaceAgents {
  scopeGuard(challenge: ChallengeSpec, userPrompt: string): Promise<ScopeGuardVerdict>;
  builder(
    challenge: ChallengeSpec,
    history: PromptTurn[],
    userPrompt: string,
    sandboxPath: string,
    options?: BuilderOptions,
  ): Promise<BuilderResult>;
  evaluator(input: EvaluatorInput): Promise<Pick<EvaluationResult, "passed" | "functionalScore" | "notes" | "disqualificationReason">>;
  coach(input: CoachInput): Promise<PostRunAnalysis>;
}

export { createOpenAIAgents } from "./agent";
export { runBuilderWithTools } from "./builder-loop";
export type { BuilderLoopOptions, BuilderToolEvent } from "./builder-loop";
export { BUILDER_TOOLS, RUN_COMMAND_TOOL, builderTools } from "./tools";
export type { BuilderToolName } from "./tools";
export type { RunCommandResult, SandboxExecutor } from "./sandbox-executor";


export function roleSystemPrompt(role: AgentRole, challenge: ChallengeSpec): string {
  switch (role) {
    case "scope_guard":
      return [
        "You are the scope guard for a timed coding race.",
        "Contestants may only use natural-language prompts to build the challenge.",
        "Reject requests that expand scope, ask for solution leaks, or violate allowedStack / outOfScope.",
        `Challenge: ${challenge.title}`,
        `Brief: ${challenge.brief}`,
        `Allowed stack: ${challenge.allowedStack.join(", ")}`,
        `Out of scope: ${challenge.outOfScope.join(", ") || "(none)"}`,
      ].join("\n");
    case "builder":
      return [
        "You are the build agent. Implement exactly what the contestant asks, within challenge scope.",
        "Prefer minimal diffs. Do not add features they did not request.",
        "Inspect existing sandbox files before writing. Preserve or deliberately update starter run scripts so the generated app remains runnable.",
        `Challenge: ${challenge.title}`,
        `Brief: ${challenge.brief}`,
        `Allowed stack: ${challenge.allowedStack.join(", ")}`,
      ].join("\n");
    case "evaluator":
      return [
        "You are the evaluator. Score functional completeness against acceptance criteria.",
        "Be strict and evidence-based. Note prompt wastefulness only in notes, not as scope expansion.",
        `Acceptance:\n- ${challenge.acceptance.join("\n- ")}`,
      ].join("\n");
    case "coach":
      return [
        "You are a post-run coach for a prompt-driven coding race.",
        "Use only the provided contestant trace and aggregate metrics.",
        "Reference exact prompt-turn numbers. Identify redundancy only when evidence exists.",
        "Only describe top-runner patterns when aggregate benchmark metrics are supplied; never claim access to another contestant's private prompts.",
        "Do not change, justify, or recommend changing the functional or leaderboard score.",
        `Challenge: ${challenge.title}`,
        `Brief: ${challenge.brief}`,
        `Acceptance:\n- ${challenge.acceptance.join("\n- ")}`,
      ].join("\n");
  }
}

export function createStubAgents(): PromptRaceAgents {
  return {
    async scopeGuard(challenge, userPrompt) {
      const blocked = challenge.outOfScope.some((p) =>
        userPrompt.toLowerCase().includes(p.toLowerCase()),
      );
      if (blocked) {
        return { allowed: false, reason: "Prompt references out-of-scope material." };
      }
      return { allowed: true, reason: "ok", sanitizedPrompt: userPrompt };
    },
    async builder(_challenge, _history, userPrompt) {
      return {
        assistantMessage: `[stub builder] Received: ${userPrompt.slice(0, 200)}`,
        filesTouched: [],
      };
    },
    async evaluator(input) {
      const passedChecks = input.checkResults.filter((c) => c.passed).length;
      const total = input.checkResults.length || 1;
      const functionalScore = passedChecks / total;
      return {
        passed: functionalScore === 1,
        functionalScore,
        notes: ["Stub evaluator — replace with GPT-5.6 evaluator."],
      };
    },
    async coach(input) {
      const turns = input.prompts.filter((turn) => turn.role === "user").length;
      return {
        attemptId: input.attemptId,
        summary: `You used ${turns} prompt turn${turns === 1 ? "" : "s"}.`,
        timeLosses: [],
        redundantPrompts: [],
        recommendations: ["Run the challenge after each meaningful implementation step."],
        topRunnerComparison: [],
      };
    },
  };
}

export { executeBuilderTool } from "./sandbox-executor";
