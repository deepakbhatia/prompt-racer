import OpenAI from "openai";
import type { ChallengeSpec, PromptTurn } from "@prompt-race/shared";
import {
  DEFAULT_MODEL,
  roleSystemPrompt,
  type AgentClientOptions,
  type BuilderResult,
  type PromptRaceAgents,
  type ScopeGuardVerdict,
} from "./index";

export function createOpenAIAgents(opts: AgentClientOptions): PromptRaceAgents {
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

    async builder(challenge, history, userPrompt, sandboxPath): Promise<BuilderResult> {
      const historyMsgs = history.map((t) => ({
        role: t.role as "user" | "assistant",
        content: t.content,
      }));

      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: roleSystemPrompt("builder", challenge) },
          {
            role: "system",
            content: `Sandbox path: ${sandboxPath}. Describe files you would write. Prefer minimal diffs.`,
          },
          ...historyMsgs,
          { role: "user", content: userPrompt },
        ],
      });

      const message = res.choices[0]?.message?.content ?? "";
      return {
        assistantMessage: message,
        filesTouched: [], // wire tool-calls / apply patches next
        tokensIn: res.usage?.prompt_tokens,
        tokensOut: res.usage?.completion_tokens,
      };
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