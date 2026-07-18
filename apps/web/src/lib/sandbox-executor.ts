import type { SandboxExecutor } from "@prompt-race/agent";
import { listSandboxFiles, readSandboxFile, writeSandboxFile } from "./sandbox-fs";

/** Binds the agent's abstract tools to one attempt's filesystem jail. */
export function createSandboxExecutor(sandboxRoot: string): SandboxExecutor {
  return {
    listFiles: (relativePath) => listSandboxFiles(sandboxRoot, relativePath ?? "."),
    readFile: (relativePath) => readSandboxFile(sandboxRoot, relativePath),
    writeFile: (relativePath, contents) => writeSandboxFile(sandboxRoot, relativePath, contents),
  };
}
