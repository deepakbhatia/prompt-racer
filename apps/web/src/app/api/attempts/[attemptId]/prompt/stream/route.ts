import { getAgents } from "@/lib/agents";
import { getChallenge } from "@/lib/challenges";
import { getAttempt, updateAttempt } from "@/lib/attempts-store";
import type { PromptTurn } from "@prompt-race/shared";

type Ctx = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

export async function POST(req: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params;
  const attempt = getAttempt(attemptId);
  if (!attempt || attempt.status !== "running") {
    return Response.json(
      { error: "Attempt not found or no longer running. Start the challenge again." },
      { status: 404 },
    );
  }

  const challenge = getChallenge(attempt.challengeId);
  if (!challenge) return Response.json({ error: "Challenge not found." }, { status: 404 });

  const { prompt } = (await req.json()) as { prompt: string };
  if (!prompt?.trim()) return Response.json({ error: "Prompt is required." }, { status: 400 });

  const agents = getAgents();

  let verdict;
  try {
    verdict = await agents.scopeGuard(challenge, prompt);
  } catch (cause) {
    console.error("Scope guard request failed", cause);
    const detail = cause instanceof Error ? cause.message : "Unknown server error.";
    return Response.json({ error: `Scope guard request failed: ${detail}` }, { status: 502 });
  }
  if (!verdict.allowed) {
    return Response.json({ blocked: true, reason: verdict.reason });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: "guard", allowed: true });

      try {
        const result = await agents.builder(
          challenge,
          attempt.prompts,
          verdict.sanitizedPrompt ?? prompt,
          attempt.sandboxPath,
        );
        if (result.assistantMessage) send({ type: "delta", text: result.assistantMessage });

        const at = new Date().toISOString();
        const userTurn: PromptTurn = {
          index: attempt.prompts.length,
          role: "user",
          content: prompt,
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
        updateAttempt(attemptId, {
          prompts: [...attempt.prompts, userTurn, assistantTurn],
        });

        send({
          type: "done",
          assistantMessage: result.assistantMessage,
          filesTouched: result.filesTouched,
        });
      } catch (cause) {
        console.error("Prompt stream failed", cause);
        const detail = cause instanceof Error ? cause.message : "Unknown server error.";
        send({ type: "error", message: `Builder request failed: ${detail}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
