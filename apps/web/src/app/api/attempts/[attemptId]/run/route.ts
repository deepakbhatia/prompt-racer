import { getAttempt } from "@/lib/attempts-store";
import { runAcceptanceChecks } from "@/lib/challenge-runner";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });

  try {
    return Response.json(await runAcceptanceChecks(attempt));
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Challenge run failed." },
      { status: 502 },
    );
  }
}
