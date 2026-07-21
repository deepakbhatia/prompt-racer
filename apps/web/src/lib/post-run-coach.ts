import { getAgents } from "@/lib/agents";
import { getRunResults, getToolEvents } from "@/lib/attempts-store";
import type { ChallengeSpec, PostRunAnalysis, RaceAttempt } from "@prompt-race/shared";

const MAX_PROMPT_CHARS = 1_500;

/**
 * Builds a bounded, contestant-local coaching request. No source files,
 * stdout/stderr bodies, identity fields, or other contestants' traces leave
 * this process for the coach call.
 */
export async function createPostRunAnalysis(
  attempt: RaceAttempt,
  challenge: ChallengeSpec,
): Promise<PostRunAnalysis> {
  const [events, runs] = await Promise.all([getToolEvents(attempt.id), getRunResults(attempt.id)]);
  return getAgents().coach({
    attemptId: attempt.id,
    challenge,
    prompts: attempt.prompts.filter((turn) => turn.role === "user").map((turn) => ({
      index: turn.index,
      role: turn.role,
      content: turn.content.slice(0, MAX_PROMPT_CHARS),
      tokensIn: turn.tokensIn,
      tokensOut: turn.tokensOut,
    })),
    toolEvents: events.map((event) => ({
      sequence: event.sequence,
      type: event.type,
      name: event.name,
      path: event.path,
      bytes: event.bytes,
      at: event.at,
    })),
    runs: runs.map((run) => ({
      exitCode: run.exitCode,
      durationMs: Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt)),
      checks: (run.checks ?? []).map((check) => ({ id: check.id, passed: check.passed })),
    })),
    evaluatorNotes: attempt.evaluation?.notes ?? [],
    // Benchmark data is intentionally omitted until an aggregate-only metrics
    // pipeline exists. The agent validator then returns no comparisons.
  });
}
