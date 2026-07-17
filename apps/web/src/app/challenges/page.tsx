import Link from "next/link";
import { listChallenges } from "@/lib/challenges";

export default function ChallengesPage() {
  const challenges = listChallenges();

  return (
    <main className="shell">
      <p className="brand">Prompt Race</p>
      <h1>Challenges</h1>
      <p className="lede">Public briefs only — golden solutions stay out of agent context.</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem" }}>
        {challenges.map((c) => (
          <li key={c.id} style={{ marginBottom: "1.25rem" }}>
            <strong>{c.title}</strong>
            <div style={{ color: "var(--muted)", marginTop: "0.25rem" }}>{c.brief}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.35rem" }}>
              {c.timeLimitSec / 60} min · {c.allowedStack.join(", ")}
            </div>
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
