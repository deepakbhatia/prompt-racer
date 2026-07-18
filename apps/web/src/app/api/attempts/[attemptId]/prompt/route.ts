import { NextResponse } from "next/server";
import { createStubAgents } from "@prompt-race/agent";
import { getChallenge } from "@/lib/challenges";
import { getAttempt, updateAttempt } from "@/lib/attempts-store";
import type { PromptTurn } from "@prompt-race/shared";

const agents = createStubAgents();

type Ctx = { params: Promise<{ attemptId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params;
  const attempt = getAttempt(attemptId);
  if (!attempt || attempt.status !== "running") {
    return NextResponse.json({ error: "Attempt not found or not running" }, { status: 404 });
  }

  const challenge = getChallenge(attempt.challengeId);
  if (!challenge) {
    return NextResponse.json({ error: "Challenge missing" }, { status: 500 });
  }

  const { prompt } = (await req.json()) as { prompt: string };
  const text = prompt?.trim();
  if (!text) {
    return NextResponse.json({ error: "Empty prompt" }, { status: 400 });
  }

  const verdict = await agents.scopeGuard(challenge, text);
  if (!verdict.allowed) {
    return NextResponse.json({
      blocked: true,
      reason: verdict.reason,
    });
  }

  const result = await agents.builder(
    challenge,
    attempt.prompts,
    verdict.sanitizedPrompt ?? text,
    attempt.sandboxPath,
  );

  const at = new Date().toISOString();
  const userTurn: PromptTurn = {
    index: attempt.prompts.length,
    role: "user",
    content: text,
    at,
  };
  const assistantTurn: PromptTurn = {
    index: attempt.prompts.length + 1,
    role: "assistant",
    content: result.assistantMessage,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    at,
  };

  const updated = updateAttempt(attemptId, {
    prompts: [...attempt.prompts, userTurn, assistantTurn],
  });

  return NextResponse.json({
    blocked: false,
    assistantMessage: result.assistantMessage,
    filesTouched: result.filesTouched,
    attempt: updated,
  });
}