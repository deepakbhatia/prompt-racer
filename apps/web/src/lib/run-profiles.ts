import type { ChallengeRuntimeProfile } from "@prompt-race/shared";

// Keep this registry server-side. A contestant cannot choose commands, images,
// ports, probes, or Docker flags. Production resolves logical image names to
// pinned digests in the runner service.
const RUNTIME_PROFILES: Record<string, ChallengeRuntimeProfile> = {
  "todo-cli": {
    kind: "cli",
    image: "prompt-race/node-cli:22",
    command: ["npm", "run", "start"],
    timeoutMs: 10_000,
  },
  "hello-http": {
    kind: "http",
    image: "prompt-race/node-http:22",
    command: ["npm", "run", "start"],
    port: 3000,
    readiness: { path: "/", expectedStatus: 200 },
    timeoutMs: 15_000,
  },
  "notes-api": {
    kind: "http",
    image: "prompt-race/node-http:22",
    command: ["npm", "run", "start"],
    port: 3000,
    readiness: { path: "/notes", expectedStatus: 200 },
    timeoutMs: 15_000,
  },
  "reading-list": {
    kind: "browser",
    image: "prompt-race/web-preview:22",
    command: ["npm", "run", "start"],
    port: 3000,
    readiness: { path: "/", expectedStatus: 200 },
    timeoutMs: 20_000,
  },
};

export function getRuntimeProfile(challengeId: string) {
  return RUNTIME_PROFILES[challengeId];
}
