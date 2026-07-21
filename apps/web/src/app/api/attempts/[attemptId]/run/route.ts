import { getAttempt, saveRun } from "@/lib/attempts-store";
import { runAcceptanceChecks } from "@/lib/challenge-runner";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = await getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });

  try {
    const result = await runAcceptanceChecks(attempt);
    await saveRun(result);
    return Response.json(result);
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Challenge run failed." },
      { status: 502 },
    );
  }
}
