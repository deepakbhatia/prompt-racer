import OpenAI from "openai";
import type { ChallengeSpec, PostRunAnalysis, PromptTurn } from "@prompt-race/shared";
import {
  DEFAULT_MODEL,
  roleSystemPrompt,
  type AgentClientOptions,
  type BuilderOptions,
  type BuilderResult,
  type CoachInput,
  type PromptRaceAgents,
  type ScopeGuardVerdict,
} from "./index";
import { runBuilderWithTools } from "./builder-loop";
import type { SandboxExecutor } from "./sandbox-executor";

export function createOpenAIAgents(
  opts: AgentClientOptions & { createExecutor: (sandboxPath: string) => SandboxExecutor },
): PromptRaceAgents {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseUrl,
  });
  const model = opts.model ?? DEFAULT_MODEL;

  return {
    async scopeGuard(challenge, userPrompt): Promise<ScopeGuardVerdict> {
      const res = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: roleSystemPrompt("scope_guard", challenge) },
          {
            role: "user",
            content: `Return JSON { "allowed": boolean, "reason": string, "sanitizedPrompt"?: string }\nPrompt:\n${userPrompt}`,
          },
        ],
      });
      const raw = res.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as ScopeGuardVerdict;
    },

    async builder(
      challenge,
      history,
      userPrompt,
      sandboxPath,
      options?: BuilderOptions,
    ): Promise<BuilderResult> {
      return runBuilderWithTools({
        client,
        model,
        challenge,
        history,
        userPrompt,
        sandboxPath,
        executor: opts.createExecutor(sandboxPath),
        onEvent: options?.onEvent,
      });
    },

    async evaluator(input) {
      // Step 6
      const passedChecks = input.checkResults.filter((c) => c.passed).length;
      const total = input.checkResults.length || 1;
      return {
        passed: passedChecks === total,
        functionalScore: passedChecks / total,
        notes: ["OpenAI evaluator not wired yet — using checkResults only."],
      };
    },

    async coach(input): Promise<PostRunAnalysis> {
      const res = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: roleSystemPrompt("coach", input.challenge) },
          {
            role: "user",
            content: JSON.stringify({
              attemptId: input.attemptId,
              prompts: input.prompts,
              toolEvents: input.toolEvents,
              runs: input.runs,
              evaluatorNotes: input.evaluatorNotes,
              benchmarkSummary: input.benchmarkSummary,
              outputSchema: {
                summary: "string",
                timeLosses: [{ promptTurn: "number", issue: "string", impact: "low|medium|high" }],
                redundantPrompts: [{ promptTurn: "number", reason: "string" }],
                recommendations: ["string"],
                topRunnerComparison: ["string"],
              },
            }),
          },
        ],
      });
      return validatePostRunAnalysis(res.choices[0]?.message?.content ?? null, input);
    },
  };
}

function validatePostRunAnalysis(raw: string | null, input: CoachInput): PostRunAnalysis {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "{}");
  } catch {
    throw new Error("Coach returned invalid JSON.");
  }
  if (!value || typeof value !== "object") throw new Error("Coach returned an invalid report.");
  const report = value as Record<string, unknown>;
  const promptTurns = new Set(input.prompts.filter((turn) => turn.role === "user").map((turn) => turn.index));
  const text = (field: unknown, fallback = ""): string =>
    typeof field === "string" ? field.slice(0, 1_000) : fallback;
  const strings = (field: unknown): string[] =>
    Array.isArray(field) ? field.filter((item): item is string => typeof item === "string").slice(0, 8).map((item) => item.slice(0, 600)) : [];
  const timeLosses = Array.isArray(report.timeLosses) ? report.timeLosses.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const loss = item as Record<string, unknown>;
    const promptTurn = loss.promptTurn;
    const impact = loss.impact;
    if (typeof promptTurn !== "number" || !promptTurns.has(promptTurn) || !["low", "medium", "high"].includes(String(impact))) return [];
    return [{ promptTurn, issue: text(loss.issue, "Unspecified issue."), impact: impact as "low" | "medium" | "high" }];
  }).slice(0, 8) : [];
  const redundantPrompts = Array.isArray(report.redundantPrompts) ? report.redundantPrompts.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const finding = item as Record<string, unknown>;
    return typeof finding.promptTurn === "number" && promptTurns.has(finding.promptTurn)
      ? [{ promptTurn: finding.promptTurn, reason: text(finding.reason, "Potentially redundant prompt.") }]
      : [];
  }).slice(0, 8) : [];

  return {
    attemptId: input.attemptId,
    summary: text(report.summary, "Coaching report completed."),
    timeLosses,
    redundantPrompts,
    recommendations: strings(report.recommendations),
    topRunnerComparison: input.benchmarkSummary ? strings(report.topRunnerComparison) : [],
  };
}
