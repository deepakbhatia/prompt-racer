import { createOpenAIAgents, createStubAgents, type PromptRaceAgents } from "@prompt-race/agent";
import { createSandboxExecutor } from "./sandbox-executor";

export function getAgents(): PromptRaceAgents {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return createStubAgents();
  return createOpenAIAgents({
    apiKey: key,
    model: process.env.OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL,
    createExecutor: createSandboxExecutor,
  });
}
