import { spawn } from "node:child_process";
import type { RunCommandResult } from "@prompt-race/agent";
import { runChallengeCommand } from "@/lib/sandbox-run";

const ALLOWED_COMMANDS = new Set(["node", "npm", "pnpm", "npx"]);

export interface CommandRunner {
  run(sandboxPath: string, command: string, args: string[], options?: { timeoutMs?: number }): Promise<RunCommandResult>;
}

export class LocalDockerCommandRunner implements CommandRunner {
  run(sandboxPath: string, command: string, args: string[], options?: { timeoutMs?: number }) {
    return runChallengeCommand(sandboxPath, command, args, options);
  }
}

/**
 * Executes a platform-owned command using Cloud Run's sandbox CLI. The caller
 * passes an already materialized workspace, which is bind-mounted at /work.
 */
export class CloudRunSandboxCommandRunner implements CommandRunner {
  async run(sandboxPath: string, command: string, args: string[], options?: { timeoutMs?: number }): Promise<RunCommandResult> {
    if (!ALLOWED_COMMANDS.has(command) || args.some((arg) => arg.includes("\0"))) {
      return { exitCode: 127, stdout: "", stderr: "Command is not allowed by the platform runner." };
    }
    const binary = process.env.CLOUD_RUN_SANDBOX_BINARY ?? "/usr/local/gcp/bin/sandbox";
    const timeoutMs = options?.timeoutMs ?? 15_000;
    return new Promise((resolve) => {
      const child = spawn(binary, [
        "do",
        "--mount", `type=bind,source=${sandboxPath},destination=/work`,
        "--env", `PATH=${process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin"}`,
        "--",
        command,
        ...args,
      ], {
        cwd: sandboxPath,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: process.env.PATH, NODE_ENV: "production" },
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < 32_000) stdout += chunk.toString("utf8"); });
      child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < 32_000) stderr += chunk.toString("utf8"); });
      child.on("error", (cause: Error) => {
        clearTimeout(timer);
        resolve({ exitCode: 127, stdout, stderr: `${stderr}${cause.message}`.slice(0, 32_000) });
      });
      child.on("close", (code: number | null) => {
        clearTimeout(timer);
        resolve({
          exitCode: timedOut ? 124 : code ?? 1,
          stdout: stdout.slice(0, 32_000),
          stderr: timedOut ? `${stderr}\n[killed: timeout ${timeoutMs}ms]`.slice(0, 32_000) : stderr.slice(0, 32_000),
        });
      });
    });
  }
}

declare global {
  var promptRaceCommandRunner: CommandRunner | undefined;
}

export function getCommandRunner(): CommandRunner {
  if (!globalThis.promptRaceCommandRunner) {
    globalThis.promptRaceCommandRunner = process.env.RUNNER_BACKEND === "cloud-run-sandbox"
      ? new CloudRunSandboxCommandRunner()
      : new LocalDockerCommandRunner();
  }
  return globalThis.promptRaceCommandRunner;
}
