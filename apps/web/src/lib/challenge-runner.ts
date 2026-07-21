import { getHttpChecks } from "@/lib/acceptance/http";
import { getRuntimeProfile } from "@/lib/run-profiles";
import { runHttpProfile } from "@/lib/runner/http-runner";
import { runChallengeCommand } from "@/lib/sandbox-run";
import type { RaceAttempt, RunResult } from "@prompt-race/shared";

/** Runs only platform-owned commands and acceptance probes for one attempt. */
export async function runAcceptanceChecks(attempt: RaceAttempt): Promise<RunResult> {
  const profile = getRuntimeProfile(attempt.challengeId);
  if (!profile) throw new Error("This challenge does not have a platform-owned run profile yet.");

  if (profile.kind !== "cli") {
    const result = await runHttpProfile({
      attemptId: attempt.id,
      sandboxPath: attempt.sandboxPath,
      profile,
      probes: profile.kind === "http" ? getHttpChecks(attempt.challengeId) : [],
    });
    if (profile.kind === "browser") {
      // A running dev server proves only readiness. Do not award a functional
      // pass until the private Playwright worker from step 14 is in place.
      return {
        ...result,
        exitCode: 1,
        checks: [
          ...(result.checks ?? []),
          {
            id: "browser-acceptance",
            passed: false,
            detail: "Browser acceptance worker is not configured yet.",
          },
        ],
      };
    }
    return result;
  }

  const startedAt = new Date().toISOString();
  const [command, ...args] = profile.command;
  const output = await runChallengeCommand(attempt.sandboxPath, command, args, {
    timeoutMs: profile.timeoutMs,
  });
  return {
    attemptId: attempt.id,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...output,
    checks: [{
      id: "command-exited",
      passed: output.exitCode === 0,
      detail: output.exitCode === 0 ? "Challenge command exited successfully." : `Challenge command exited ${output.exitCode}.`,
    }],
  };
}
