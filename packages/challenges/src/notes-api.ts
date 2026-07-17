import type { ChallengeSpec } from "@prompt-race/shared";

/** CRUD API task with intentionally in-memory storage. */
export const notesApi: ChallengeSpec = {
  id: "notes-api",
  title: "Notes API",
  brief:
    "Ship a local JSON HTTP API for short notes. Notes have an id, title, body, and createdAt timestamp. Keep data in memory; a database is not required.",
  timeLimitSec: 25 * 60,
  allowedStack: ["Node.js", "TypeScript or JavaScript", "stdlib http or a minimal framework"],
  outOfScope: ["database", "authentication", "frontend", "docker", "pagination"],
  acceptance: [
    "The server starts via a documented npm/pnpm script or node entrypoint",
    "POST /notes with a JSON title and body returns 201 and a note containing a non-empty id and createdAt",
    "GET /notes returns 200 and a JSON array containing notes created during the server session",
    "GET /notes/:id returns 200 and the matching note",
    "DELETE /notes/:id returns 204 and a later GET /notes/:id returns 404",
    "Malformed JSON and missing title return a JSON 4xx response without crashing the server",
  ],
};
