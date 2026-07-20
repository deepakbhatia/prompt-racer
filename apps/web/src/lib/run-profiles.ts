import type { RunProfile } from "@prompt-race/shared";

// Keep this registry server-side. A contestant cannot choose its command or arguments.
const RUN_PROFILES: Record<string, RunProfile> = {
  // The brief permits any documented CLI entrypoint, so list generated scripts
  // rather than assuming a task name or command arguments.
  "todo-cli": { command: "npm", args: ["run"], timeoutMs: 5_000 },
  "hello-http": { command: "npm", args: ["run", "start"], timeoutMs: 5_000 },
  "notes-api": { command: "npm", args: ["run", "start"], timeoutMs: 5_000 },
  "reading-list": { command: "npm", args: ["run", "dev"], timeoutMs: 5_000 },
};

export function getRunProfile(challengeId: string) {
  return RUN_PROFILES[challengeId];
}
