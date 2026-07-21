import type { HttpProbe } from "@/lib/runner/types";

const helloHttpChecks: HttpProbe[] = [
  { id: "hello-response", method: "GET", path: "/", expectedStatus: 200 },
];

const notesApiChecks: HttpProbe[] = [
  { id: "list-notes", method: "GET", path: "/notes", expectedStatus: 200 },
  {
    id: "create-note",
    method: "POST",
    path: "/notes",
    body: { title: "Race note", body: "Created by acceptance check" },
    expectedStatus: 201,
  },
];

export function getHttpChecks(challengeId: string): HttpProbe[] {
  if (challengeId === "hello-http") return helloHttpChecks;
  if (challengeId === "notes-api") return notesApiChecks;
  return [];
}
