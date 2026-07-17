import type { ChallengeSpec } from "@prompt-race/shared";

/** Starter challenge: tiny HTTP “hello” service. */
export const helloHttp: ChallengeSpec = {
  id: "hello-http",
  title: "Hello HTTP",
  brief:
    "Ship a local HTTP server that responds to GET / with JSON { \"ok\": true, \"message\": \"hello\" } and exits cleanly.",
  timeLimitSec: 15 * 60,
  allowedStack: ["Node.js", "stdlib http or a minimal framework"],
  outOfScope: ["database", "auth", "frontend framework", "docker"],
  acceptance: [
    "GET / returns 200",
    "Body is JSON with ok=true and message=hello",
    "Server starts via a documented npm/pnpm script or node entrypoint",
  ],
};
