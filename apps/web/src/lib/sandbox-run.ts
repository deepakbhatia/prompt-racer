import { spawn } from "node:child_process";
import path from "node:path";
import type { RunCommandResult } from "@prompt-race/agent";

const ALLOWED = new Set(["node", "npm", "pnpm", "npx"]);

const BLOCKED_ARGS = [
  /node_modules/i, // optional policy
];

export async function runInSandbox(
  sandboxRoot: string,
  command: string,
  args: string[],
  opts?: { timeoutMs?: number; maxOutput?: number },
): Promise<RunCommandResult> {
  if (!ALLOWED.has(command)) {
    return {
      exitCode: 127,
      stdout: "",
      stderr: `Command not allowed: ${command}. Allowed: ${[...ALLOWED].join(", ")}`,
    };
  }

  // Reject absolute paths in args that point outside sandbox (belt and suspenders)
  const root = path.resolve(sandboxRoot);
  for (const a of args) {
    if (path.isAbsolute(a)) {
      const resolved = path.resolve(a);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Argument escapes sandbox: ${a}`,
        };
      }
    }
  }

  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maxOutput = opts?.maxOutput ?? 32_000;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      env: {
        PATH: process.env.PATH,
        HOME: root,
        TMPDIR: path.join(root, ".tmp"),
        NODE_ENV: "development",
        // intentionally omit OPENAI_API_KEY and other secrets
      },
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (buf: Buffer) => {
      if (stdout.length < maxOutput) stdout += buf.toString("utf8");
    });
    child.stderr.on("data", (buf: Buffer) => {
      if (stderr.length < maxOutput) stderr += buf.toString("utf8");
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: killed ? 124 : code ?? 1,
        stdout: stdout.slice(0, maxOutput),
        stderr: killed
          ? `${stderr.slice(0, maxOutput)}\n[killed: timeout ${timeoutMs}ms]`
          : stderr.slice(0, maxOutput),
      });
    });
  });
}