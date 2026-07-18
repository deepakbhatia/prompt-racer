import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type { ChallengeSpec, PromptTurn } from "@prompt-race/shared";
import { roleSystemPrompt, type BuilderResult } from "./index";
import { executeBuilderTool, type SandboxExecutor } from "./sandbox-executor";
import { BUILDER_TOOLS } from "./tools";

const MAX_TOOL_ROUNDS = 20;

export async function runBuilderWithTools(options: {
  client: OpenAI;
  model: string;
  challenge: ChallengeSpec;
  history: PromptTurn[];
  userPrompt: string;
  sandboxPath: string;
  executor: SandboxExecutor;
}): Promise<BuilderResult> {
  const { client, model, challenge, history, userPrompt, sandboxPath, executor } = options;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: roleSystemPrompt("builder", challenge) },
    {
      role: "system",
      content: [
        `Your sandbox root is ${sandboxPath}.`,
        "Use the provided tools to inspect and modify files.",
        "All tool paths must be relative to the sandbox root.",
        "Implement only the contestant's request. When complete, return a short summary.",
      ].join("\n"),
    },
    ...history.map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: turn.content,
    })),
    { role: "user", content: userPrompt },
  ];

  const filesTouched = new Set<string>();
  let tokensIn = 0;
  let tokensOut = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: BUILDER_TOOLS,
      tool_choice: "auto",
      // gpt-5.6-luna only permits Chat Completions function tools when reasoning is disabled.
      reasoning_effort: "none",
    });
    tokensIn += response.usage?.prompt_tokens ?? 0;
    tokensOut += response.usage?.completion_tokens ?? 0;

    const message = response.choices[0]?.message;
    if (!message) break;
    messages.push(message);

    const toolCalls = message.tool_calls as ChatCompletionMessageToolCall[] | undefined;
    if (!toolCalls?.length) {
      return {
        assistantMessage: message.content ?? "Builder completed without a summary.",
        filesTouched: [...filesTouched],
        tokensIn,
        tokensOut,
      };
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const result = await executeBuilderTool(call.function.name, call.function.arguments, executor);

      if (result.ok && call.function.name === "write_file") {
        try {
          const args = JSON.parse(call.function.arguments) as { path?: unknown };
          if (typeof args.path === "string") filesTouched.add(args.path);
        } catch {
          // The executor already returned a tool error for malformed arguments.
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    assistantMessage: filesTouched.size
      ? `Updated ${[...filesTouched].join(", ")}. Stopped after ${MAX_TOOL_ROUNDS} tool rounds.`
      : `Stopped after ${MAX_TOOL_ROUNDS} tool rounds without changing files.`,
    filesTouched: [...filesTouched],
    tokensIn,
    tokensOut,
  };
}
