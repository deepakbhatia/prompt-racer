import Link from "next/link";
import type { RaceAttempt } from "@prompt-race/shared";
import { listCompletedAttempts } from "@/lib/attempts-store";
import { listChallenges } from "@/lib/challenges";

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

function statusLabel(status: RaceAttempt["status"]) {
  if (status === "passed") return "Passed";
  if (status === "failed") return "Not passed";
  if (status === "disqualified") return "Disqualified";
  return status === "submitted" ? "Submitted" : "Running";
}

export default async function HomePage() {
  const [challenges, completedAttempts] = await Promise.all([
    Promise.resolve(listChallenges()),
    listCompletedAttempts(24),
  ]);
  const bestByChallenge = new Map<string, (typeof completedAttempts)[number]>();
  for (const attempt of completedAttempts) {
    const best = bestByChallenge.get(attempt.challengeId);
    if (!best || (attempt.evaluation?.compositeScore ?? 0) > (best.evaluation?.compositeScore ?? 0)) {
      bestByChallenge.set(attempt.challengeId, attempt);
    }
  }

  return (
    <main className="shell shell--wide home-dashboard">
      <p className="brand">Prompt Race</p>
      <h1>Build working apps with prompts alone.</h1>
      <p className="lede">
        Race the clock — and your token budget. GPT-5.6 builds, guards scope, and scores
        prompt efficiency.
      </p>
      <div className="cta">
        <Link href="/races">Enter a race</Link>
        <Link href="/challenges" className="secondary">Browse challenges</Link>
      </div>

      <section className="home-section" aria-labelledby="home-challenges">
        <div className="home-section__header">
          <div>
            <p className="eyebrow">Choose your next build</p>
            <h2 id="home-challenges">Challenges</h2>
          </div>
          <Link href="/challenges" className="text-link">View all</Link>
        </div>
        <div className="home-challenge-grid">
          {challenges.map((challenge) => {
            const best = bestByChallenge.get(challenge.id);
            return (
              <article className="home-challenge-card" key={challenge.id}>
                <div>
                  <h3>{challenge.title}</h3>
                  <p>{challenge.brief}</p>
                </div>
                <div className="home-challenge-card__meta">
                  <span>{challenge.timeLimitSec / 60} min</span>
                  {best?.evaluation ? <span>Best score {best.evaluation.compositeScore.toFixed(3)}</span> : <span>Not submitted yet</span>}
                </div>
                <Link href={`/challenges/${challenge.id}/workspace`} className="challenge-card__start">Start challenge</Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-results">
        <div className="home-section__header">
          <div>
            <p className="eyebrow">Your submitted attempts</p>
            <h2 id="home-results">Results comparison</h2>
          </div>
        </div>
        {completedAttempts.length === 0 ? (
          <p className="dashboard-empty">Submit a challenge to compare speed, prompt efficiency, and functional quality here.</p>
        ) : (
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Challenge</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>Functional</th>
                  <th>Checks</th>
                  <th>Time</th>
                  <th>Prompts</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {completedAttempts.map((attempt) => {
                  const evaluation = attempt.evaluation;
                  const passedChecks = attempt.checkResults?.filter((check) => check.passed).length ?? 0;
                  const checks = attempt.checkResults?.length ?? 0;
                  return (
                    <tr key={attempt.id}>
                      <td><strong>{challenges.find((challenge) => challenge.id === attempt.challengeId)?.title ?? attempt.challengeId}</strong></td>
                      <td><span className={`result-badge result-badge--${attempt.status}`}>{statusLabel(attempt.status)}</span></td>
                      <td>{evaluation ? evaluation.compositeScore.toFixed(3) : "—"}</td>
                      <td>{evaluation ? `${Math.round(evaluation.functionalScore * 100)}%` : "—"}</td>
                      <td>{checks ? `${passedChecks}/${checks}` : "—"}</td>
                      <td>{evaluation ? formatDuration(evaluation.elapsedSec) : "—"}</td>
                      <td>{evaluation?.promptTurns ?? "—"}</td>
                      <td>{evaluation ? evaluation.promptTokens.toLocaleString() : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="dashboard-note">Useful comparison signals: functional score and checks show quality; elapsed time shows speed; prompt turns and tokens show efficiency.</p>
      </section>
    </main>
  );
}
