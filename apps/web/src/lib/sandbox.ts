import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export {
  listSandboxFiles,
  readSandboxFile,
  resolveInSandbox,
  SandboxPathError,
  writeSandboxFile,
} from "./sandbox-fs";

// From apps/web, monorepo root is two levels up when cwd is apps/web.
// Prefer an absolute root via env in production:
const ROOT = process.env.SANDBOX_ROOT ?? path.join(process.cwd(), "sandboxes");

export function sandboxPathFor(raceId: string, attemptId: string) {
  return path.join(ROOT, raceId, attemptId);
}

export async function createSandbox(raceId: string, attemptId: string, challengeId: string) {
  const dir = sandboxPathFor(raceId, attemptId);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "README.md"),
    `# Attempt ${attemptId}\n\nChallenge: ${challengeId}\nBuilder writes files here.\n`,
    "utf8",
  );
  return dir;
}
