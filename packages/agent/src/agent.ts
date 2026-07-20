import OpenAI from "openai";
import type { ChallengeSpec, PromptTurn } from "@prompt-race/shared";
import {
  DEFAULT_MODEL,
  roleSystemPrompt,
  type AgentClientOptions,
  type BuilderOptions,
  type BuilderResult,
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
  };
}
