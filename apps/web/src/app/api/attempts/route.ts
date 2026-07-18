import { NextResponse } from "next/server";
import { getChallenge } from "@/lib/challenges";
import { createSandbox } from "@/lib/sandbox";
import { saveAttempt } from "@/lib/attempts-store";
import type { RaceAttempt } from "@prompt-race/shared";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    challengeId: string;
    contestantId?: string;
  };

  const challenge = getChallenge(body.challengeId);
  if (!challenge) {
    return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
  }

  const attemptId = crypto.randomUUID();
  const raceId = "solo"; // single-player heats for now
  const sandboxPath = await createSandbox(raceId, attemptId, challenge.id);

  const attempt: RaceAttempt = {
    id: attemptId,
    raceId,
    contestantId: body.contestantId ?? "local-dev",
    challengeId: challenge.id,
    status: "running",
    startedAt: new Date().toISOString(),
    prompts: [],
    sandboxPath,
  };

  saveAttempt(attempt);
  return NextResponse.json({ attempt });
}
