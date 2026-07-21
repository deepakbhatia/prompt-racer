import { NextResponse } from "next/server";
import { getChallenge } from "@/lib/challenges";
import { saveAttempt } from "@/lib/attempts-store";
import { getWorkspaceStore } from "@/lib/workspace-store";
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
  const sandboxRef = `${raceId}/${attemptId}`;
  const sandboxPath = await getWorkspaceStore().create(sandboxRef, challenge.id);

  const attempt: RaceAttempt = {
    id: attemptId,
    raceId,
    contestantId: body.contestantId ?? "local-dev",
    challengeId: challenge.id,
    status: "running",
    startedAt: new Date().toISOString(),
    sandboxRef,
    prompts: [],
    sandboxPath,
  };

  await saveAttempt(attempt);
  return NextResponse.json({ attempt });
}
