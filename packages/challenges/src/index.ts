import type { ChallengeSpec } from "@prompt-race/shared";
import { helloHttp } from "./hello-http";
import { notesApi } from "./notes-api";
import { readingList } from "./reading-list";
import { todoCli } from "./todo-cli";

export { helloHttp, notesApi, readingList, todoCli };

const CHALLENGES: ChallengeSpec[] = [helloHttp, todoCli, notesApi, readingList];

export function listChallenges(): ChallengeSpec[] {
  return CHALLENGES;
}

export function getChallenge(id: string): ChallengeSpec | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
