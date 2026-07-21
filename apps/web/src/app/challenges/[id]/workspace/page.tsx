import { notFound } from "next/navigation";
import Link from "next/link";
import { getChallenge } from "@/lib/challenges";
import { WorkspaceClient } from "./workspace-client";

type Props = { params: Promise<{ id: string }> };

export default async function WorkspacePage({ params }: Props) {
  const { id } = await params;
  const challenge = getChallenge(id);
  if (!challenge) notFound();

  return (
    <main className="shell shell--wide">
      <p className="brand">Prompt Race</p>
      <h1>{challenge.title}</h1>
      <p className="lede">{challenge.brief}</p>

      <dl className="challenge-meta">
        <div>
          <dt>Time limit</dt>
          <dd>{challenge.timeLimitSec / 60} minutes</dd>
        </div>
        <div>
          <dt>Allowed stack</dt>
          <dd>{challenge.allowedStack.join(", ")}</dd>
        </div>
        <div>
          <dt>Out of scope</dt>
          <dd>{challenge.outOfScope.join(", ") || "—"}</dd>
        </div>
      </dl>

      <section className="acceptance">
        <h2>Acceptance</h2>
        <ul>
          {challenge.acceptance.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      {/* Client island for prompts — Step 3 fills this in */}
      <WorkspaceClient challenge={challenge} />

      <div className="cta" style={{ marginTop: "2rem" }}>
        <Link href="/" className="secondary">
          Home
        </Link>
        <Link href="/challenges" className="secondary">
          All challenges
        </Link>
      </div>
    </main>
  );
}
