import Link from "next/link";
import { listChallenges } from "@/lib/challenges";

export default function ChallengesPage() {
  const challenges = listChallenges();

  return (
    <main className="shell">
      <p className="brand">Prompt Race</p>
      <h1>Challenges</h1>
      <p className="lede">Pick a challenge. Build it with prompts only.</p>

      <ul className="challenge-grid">
        {challenges.map((c) => (
          <li key={c.id}>
            <details className="challenge-card">
              <summary>
                <strong>{c.title}</strong>
                <span aria-hidden="true" className="challenge-card__indicator" />
              </summary>
              <div className="challenge-card__details">
                <p>{c.brief}</p>
                <p className="challenge-card__meta">
                  {c.timeLimitSec / 60} min · {c.allowedStack.join(", ")}
                </p>
                <Link href={`/challenges/${c.id}/workspace`} className="challenge-card__start">
                  Start challenge
                </Link>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <div className="cta">
        <Link href="/" className="secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
