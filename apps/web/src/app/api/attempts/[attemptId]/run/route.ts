import { getAttempt } from "@/lib/attempts-store";
import { getHttpChecks } from "@/lib/acceptance/http";
import { getRuntimeProfile } from "@/lib/run-profiles";
import { runHttpProfile } from "@/lib/runner/http-runner";
import { runChallengeCommand } from "@/lib/sandbox-run";
import type { RunResult } from "@prompt-race/shared";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });

  const profile = getRuntimeProfile(attempt.challengeId);
  if (!profile) {
    return Response.json(
      { error: "This challenge does not have a platform-owned run profile yet." },
      { status: 409 },
    );
  }

  const result: RunResult = profile.kind === "cli"
    ? await runCliProfile(attemptId, attempt.sandboxPath, profile.command, profile.timeoutMs)
    : await runHttpProfile({
        attemptId,
        sandboxPath: attempt.sandboxPath,
        profile,
        probes: profile.kind === "http" ? getHttpChecks(attempt.challengeId) : [],
      });
  return Response.json(result);
}

async function runCliProfile(
  attemptId: string,
  sandboxPath: string,
  [command, ...args]: ["npm", "run", string],
  timeoutMs: number,
): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const output = await runChallengeCommand(sandboxPath, command, args, { timeoutMs });
  return { attemptId, startedAt, finishedAt: new Date().toISOString(), ...output };
}
