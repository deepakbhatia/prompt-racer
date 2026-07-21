import { spawn } from "node:child_process";
import path from "node:path";
import type { RunCommandResult } from "@prompt-race/agent";
import { resolveApprovedRunnerImage } from "./runner/images";

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

/**
 * Model-selected commands are enabled only inside the Docker isolation boundary.
 * Fixed challenge run profiles may use runInSandbox during local development.
 */
export function modelCommandExecutionEnabled() {
  return process.env.SANDBOX_RUNNER === "docker" || process.env.RUNNER_BACKEND === "cloud-run-sandbox";
}

function localDevelopmentExecutionEnabled() {
  return process.env.SANDBOX_RUNNER === "local-dev";
}

/**
 * Runs a platform-owned profile. Local host execution is only for an explicit
 * development setting because the profile can invoke contestant-authored scripts.
 */
export async function runChallengeCommand(
  sandboxRoot: string,
  command: string,
  args: string[],
  opts?: { timeoutMs?: number; maxOutput?: number },
) {
  return localDevelopmentExecutionEnabled()
    ? runInSandbox(sandboxRoot, command, args, opts)
    : runInIsolatedSandbox(sandboxRoot, command, args, opts);
}

export async function runInIsolatedSandbox(
  sandboxRoot: string,
  command: string,
  args: string[],
  opts?: { timeoutMs?: number; maxOutput?: number },
): Promise<RunCommandResult> {
  if (!modelCommandExecutionEnabled()) {
    return {
      exitCode: 126,
      stdout: "",
      stderr: "Model command execution is disabled. Set SANDBOX_RUNNER=docker after configuring Docker.",
    };
  }
  if (!ALLOWED.has(command)) {
    return {
      exitCode: 127,
      stdout: "",
      stderr: `Command not allowed: ${command}. Allowed: ${[...ALLOWED].join(", ")}`,
    };
  }
  if (args.some((arg) => arg.includes("\0"))) {
    return { exitCode: 1, stdout: "", stderr: "Command arguments cannot contain null bytes." };
  }

  const root = path.resolve(sandboxRoot);
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maxOutput = opts?.maxOutput ?? 32_000;
  const dockerArgs = [
    "run",
    "--rm",
    "--network=none",
    "--memory=256m",
    "--cpus=0.5",
    "--pids-limit=64",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=64m",
    "--mount",
    `type=bind,src=${root},dst=/work`,
    "--workdir",
    "/work",
    "--env",
    "HOME=/tmp",
    resolveApprovedRunnerImage("prompt-race/node-cli:22"),
    command,
    ...args,
  ];

  return new Promise((resolve) => {
    const child = spawn("docker", dockerArgs, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: process.env.PATH, NODE_ENV: "production" },
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    let settled = false;
    const finish = (result: RunCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (buffer: Buffer) => {
      if (stdout.length < maxOutput) stdout += buffer.toString("utf8");
    });
    child.stderr.on("data", (buffer: Buffer) => {
      if (stderr.length < maxOutput) stderr += buffer.toString("utf8");
    });
    child.on("error", (cause: Error) => {
      finish({ exitCode: 127, stdout, stderr: `${stderr}${cause.message}`.slice(0, maxOutput) });
    });
    child.on("close", (code: number | null) => {
      finish({
        exitCode: killed ? 124 : code ?? 1,
        stdout: stdout.slice(0, maxOutput),
        stderr: killed
          ? `${stderr.slice(0, maxOutput)}\n[killed: timeout ${timeoutMs}ms]`
          : stderr.slice(0, maxOutput),
      });
    });
  });
}
