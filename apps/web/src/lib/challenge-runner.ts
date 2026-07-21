import { getHttpChecks } from "@/lib/acceptance/http";
import { getRuntimeProfile } from "@/lib/run-profiles";
import { getCommandRunner } from "@/lib/runner/command-runner";
import { runHttpProfile } from "@/lib/runner/http-runner";
import { getWorkspaceStore } from "@/lib/workspace-store";
import type { RaceAttempt, RunResult } from "@prompt-race/shared";

/** Runs only platform-owned commands and acceptance probes for one attempt. */
export async function runAcceptanceChecks(attempt: RaceAttempt): Promise<RunResult> {
  const profile = getRuntimeProfile(attempt.challengeId);
  if (!profile) throw new Error("This challenge does not have a platform-owned run profile yet.");

  if (profile.kind !== "cli") {
    if (process.env.RUNNER_BACKEND === "cloud-run-sandbox") {
      return unsupportedCloudRunResult(attempt.id, profile.kind);
    }
    const result = await getWorkspaceStore().withWorkspace(attempt.sandboxRef, (sandboxPath) => runHttpProfile({
      attemptId: attempt.id,
      sandboxPath,
      profile,
      probes: profile.kind === "http" ? getHttpChecks(attempt.challengeId) : [],
    }));
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
  const output = await getWorkspaceStore().withWorkspace(attempt.sandboxRef, (sandboxPath) =>
    getCommandRunner().run(sandboxPath, command, args, { timeoutMs: profile.timeoutMs }),
  );
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

function unsupportedCloudRunResult(attemptId: string, kind: "http" | "browser"): RunResult {
  const now = new Date().toISOString();
  const detail = `Cloud Run Sandbox ${kind} lifecycle runner is not configured yet.`;
  return {
    attemptId,
    startedAt: now,
    finishedAt: now,
    exitCode: 126,
    stdout: "",
    stderr: detail,
    checks: [{ id: "runner-configuration", passed: false, detail }],
  };
}
