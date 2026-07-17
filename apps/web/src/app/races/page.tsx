import Link from "next/link";

export default function RacesPage() {
  return (
    <main className="shell">
      <p className="brand">Prompt Race</p>
      <h1>Races</h1>
      <p className="lede">Lobby and live heats will land here. Scaffold only for now.</p>
      <div className="cta">
        <Link href="/" className="secondary">
          Back
        </Link>
      </div>
    </main>
  );
}
