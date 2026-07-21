import { getAttempt } from "@/lib/attempts-store";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

/** Coaching is available only once an attempt has completed submission. */
export async function GET(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = await getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status === "running" || attempt.status === "submitted") {
    return Response.json({ error: "Coaching is available after submission." }, { status: 409 });
  }
  if (!attempt.postRunAnalysis) {
    return Response.json({ error: "Coaching is not available for this attempt." }, { status: 404 });
  }
  return Response.json({ analysis: attempt.postRunAnalysis });
}
