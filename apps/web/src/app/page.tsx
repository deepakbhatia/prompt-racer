import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <p className="brand">Prompt Race</p>
      <h1>Build working apps with prompts alone.</h1>
      <p className="lede">
        Race the clock — and your token budget. GPT-5.6 builds, guards scope, and scores
        prompt efficiency.
      </p>
      <div className="cta">
        <Link href="/races">Enter a race</Link>
        <Link href="/challenges" className="secondary">
          Browse challenges
        </Link>
      </div>
    </main>
  );
}
