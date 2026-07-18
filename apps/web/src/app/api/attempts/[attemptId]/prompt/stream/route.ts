import { getAgents } from "@/lib/agents";
import { getChallenge } from "@/lib/challenges";
import { getAttempt, updateAttempt } from "@/lib/attempts-store";
import type { PromptTurn } from "@prompt-race/shared";
import OpenAI from "openai";

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

  const apiKey = process.env.OPENAI_API_KEY;
  const client = apiKey
    ? new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL })
    : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: "guard", allowed: true });

      try {
        let full = "";
        console.log( process.env.OPENAI_MODEL ?? "gpt-5.6",)
        if (client) {
          const completion = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? "gpt-5.6",
            stream: true,
            messages: [
              {
                role: "system",
                content: `Build within challenge: ${challenge.title}. Sandbox: ${attempt.sandboxPath}`,
              },
              ...attempt.prompts.map((t) => ({
                role: t.role as "user" | "assistant",
                content: t.content,
              })),
              { role: "user", content: verdict.sanitizedPrompt ?? prompt },
            ],
          });

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              full += delta;
              send({ type: "delta", text: delta });
            }
          }
        } else {
          const result = await agents.builder(
            challenge,
            attempt.prompts,
            verdict.sanitizedPrompt ?? prompt,
            attempt.sandboxPath,
          );
          full = result.assistantMessage;
          if (full) send({ type: "delta", text: full });
        }

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
          content: full,
          at,
        };
        updateAttempt(attemptId, {
          prompts: [...attempt.prompts, userTurn, assistantTurn],
        });

        send({ type: "done", assistantMessage: full });
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
