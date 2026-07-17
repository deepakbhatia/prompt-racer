/**
 * Scoring: speed + prompt efficiency.
 *
 * composite = functionalGate * (wSpeed * speedScore + wEff * efficiencyScore)
 * - functionalGate: 0 if failed acceptance, else 1 (or soft functionalScore)
 * - speedScore: 1 when fast relative to time limit, 0 at limit
 * - efficiencyScore: rewards fewer tokens / turns
 */

import type { EvaluationResult } from "@prompt-race/shared";

export interface ScoreWeights {
  speed: number;
  efficiency: number;
  /** If true, partial functionalScore still multiplies composite. */
  softFunctional: boolean;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  speed: 0.45,
  efficiency: 0.55,
  softFunctional: false,
};

export interface RawMetrics {
  passed: boolean;
  functionalScore: number;
  elapsedSec: number;
  timeLimitSec: number;
  promptTokens: number;
  promptTurns: number;
  /** Soft caps used to normalize efficiency (tune per challenge tier). */
  tokenBudget?: number;
  turnBudget?: number;
  notes?: string[];
  disqualificationReason?: string;
  attemptId: string;
}

export function efficiencyScore(tokens: number, turns: number, tokenBudget = 8_000, turnBudget = 12): number {
  const tokenPart = Math.max(0, 1 - tokens / tokenBudget);
  const turnPart = Math.max(0, 1 - turns / turnBudget);
  return 0.7 * tokenPart + 0.3 * turnPart;
}

export function speedScore(elapsedSec: number, timeLimitSec: number): number {
  if (timeLimitSec <= 0) return 0;
  return Math.max(0, 1 - elapsedSec / timeLimitSec);
}

export function computeEvaluation(raw: RawMetrics, weights: ScoreWeights = DEFAULT_WEIGHTS): EvaluationResult {
  const eff = efficiencyScore(
    raw.promptTokens,
    raw.promptTurns,
    raw.tokenBudget,
    raw.turnBudget,
  );
  const spd = speedScore(raw.elapsedSec, raw.timeLimitSec);
  const gate = weights.softFunctional
    ? raw.functionalScore
    : raw.passed
      ? 1
      : 0;

  const compositeScore =
    gate * (weights.speed * spd + weights.efficiency * eff);

  return {
    attemptId: raw.attemptId,
    passed: raw.passed,
    functionalScore: raw.functionalScore,
    elapsedSec: raw.elapsedSec,
    promptTokens: raw.promptTokens,
    promptTurns: raw.promptTurns,
    efficiencyScore: eff,
    compositeScore,
    notes: raw.notes ?? [],
    disqualificationReason: raw.disqualificationReason,
  };
}
