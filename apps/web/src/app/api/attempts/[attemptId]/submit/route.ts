import { getAgents } from "@/lib/agents";
import { runAcceptanceChecks } from "@/lib/challenge-runner";
import { getChallenge } from "@/lib/challenges";
import { submitAttempt, updateAttempt } from "@/lib/attempts-store";
import { computeEvaluation } from "@prompt-race/scoring";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

/** Finalizes an attempt. This is the only transition from building to scoring. */
export async function POST(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = submitAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt is not running." }, { status: 409 });

  const challenge = getChallenge(attempt.challengeId);
  if (!challenge) {
    updateAttempt(attemptId, { status: "failed" });
    return Response.json({ error: "Challenge not found." }, { status: 404 });
  }

  try {
    const run = await runAcceptanceChecks(attempt);
    const checkResults = run.checks ?? [{
      id: "runner-exit",
      passed: run.exitCode === 0,
      detail: `Runner exited ${run.exitCode}.`,
    }];
    const deterministicFunctionalScore = checkResults.filter((check) => check.passed).length / checkResults.length;
    const elapsedSec = Math.max(0, (Date.now() - Date.parse(attempt.startedAt)) / 1_000);
    const qualitative = await getAgents().evaluator({
      challenge,
      prompts: attempt.prompts,
      sandboxPath: attempt.sandboxPath,
      elapsedSec,
      checkResults,
    });

    // An LLM can explain the evidence, but never overturn a failing deterministic check.
    const passed = deterministicFunctionalScore === 1 && qualitative.passed;
    const promptTokens = attempt.prompts.reduce(
      (total, turn) => total + (turn.tokensIn ?? 0) + (turn.tokensOut ?? 0),
      0,
    );
    const result = computeEvaluation({
      attemptId,
      passed,
      functionalScore: Math.min(deterministicFunctionalScore, qualitative.functionalScore),
      elapsedSec,
      timeLimitSec: challenge.timeLimitSec,
      promptTokens,
      promptTurns: attempt.prompts.filter((turn) => turn.role === "user").length,
      notes: qualitative.notes,
      disqualificationReason: qualitative.disqualificationReason,
    });

    updateAttempt(attemptId, {
      status: result.passed ? "passed" : "failed",
      checkResults,
      evaluation: result,
    });
    return Response.json({ result, checkResults, run });
  } catch (cause) {
    updateAttempt(attemptId, { status: "failed" });
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Submission failed." },
      { status: 502 },
    );
  }
}
