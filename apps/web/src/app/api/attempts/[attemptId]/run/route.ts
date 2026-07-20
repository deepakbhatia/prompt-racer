import { getAttempt } from "@/lib/attempts-store";
import { getRunProfile } from "@/lib/run-profiles";
import { runChallengeCommand } from "@/lib/sandbox-run";
import type { RunResult } from "@prompt-race/shared";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });

  const profile = getRunProfile(attempt.challengeId);
  if (!profile) {
    return Response.json(
      { error: "This challenge does not have a platform-owned run profile yet." },
      { status: 409 },
    );
  }

  const startedAt = new Date().toISOString();
  const output = await runChallengeCommand(attempt.sandboxPath, profile.command, profile.args, {
    timeoutMs: profile.timeoutMs,
  });
  const result: RunResult = {
    attemptId,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...output,
  };
  return Response.json(result);
}
