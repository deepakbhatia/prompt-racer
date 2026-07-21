import type { SandboxExecutor } from "@prompt-race/agent";
import { listSandboxFiles, readSandboxFile, writeSandboxFile } from "./sandbox-fs";
import { getCommandRunner } from "./runner/command-runner";
import { modelCommandExecutionEnabled } from "./sandbox-run";

/** Binds the agent's abstract tools to one attempt's filesystem jail. */
export function createSandboxExecutor(sandboxRoot: string): SandboxExecutor {
  const executor: SandboxExecutor = {
    listFiles: (relativePath) => listSandboxFiles(sandboxRoot, relativePath ?? "."),
    readFile: (relativePath) => readSandboxFile(sandboxRoot, relativePath),
    writeFile: (relativePath, contents) => writeSandboxFile(sandboxRoot, relativePath, contents),
  };
  if (modelCommandExecutionEnabled()) {
    executor.runCommand = (command, args) => getCommandRunner().run(sandboxRoot, command, args ?? []);
  }
  return executor;
}
