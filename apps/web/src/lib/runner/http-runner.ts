import { spawn } from "node:child_process";
import path from "node:path";
import type { ChallengeRuntimeProfile, RunCheckResult, RunResult } from "@prompt-race/shared";
import type { HttpProbe, ManagedRun } from "./types";
import { resolveApprovedRunnerImage } from "./images";

function runDocker(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"] as const,
      env: { PATH: process.env.PATH, NODE_ENV: "production" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error: Error) => resolve({ stdout, stderr: `${stderr}${error.message}`, exitCode: 127 }));
    child.on("close", (code: number | null) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });
}

function asPath(value: string) {
  if (!value.startsWith("/") || value.includes("\0") || value.includes("..")) {
    throw new Error("HTTP probe path must be a safe absolute path.");
  }
  return value;
}

async function requestAt(baseUrl: string, probe: HttpProbe) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${baseUrl}${asPath(probe.path)}`, {
      method: probe.method,
      headers: probe.body === undefined ? undefined : { "content-type": "application/json" },
      body: probe.body === undefined ? undefined : JSON.stringify(probe.body),
      signal: controller.signal,
    });
    return { status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Starts an attempt-owned HTTP process. The mapped port is bound to loopback,
 * so it is available only to this host (and the local workspace browser).
 */
export async function startHttpRun(input: {
  sandboxPath: string;
  image: ChallengeRuntimeProfile["image"];
  command: string[];
  containerPort: number;
}): Promise<ManagedRun> {
  const image = resolveApprovedRunnerImage(input.image);
  const sandboxPath = path.resolve(input.sandboxPath);
  const launch = await runDocker([
    "run", "-d", "--rm",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--memory=256m", "--cpus=0.5", "--pids-limit=64",
    "--mount", `type=bind,src=${sandboxPath},dst=/work`,
    "--workdir", "/work",
    "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m",
    "--env", "HOME=/tmp",
    "-p", `127.0.0.1::${input.containerPort}`,
    image,
    ...input.command,
  ]);
  const containerId = launch.stdout.trim();
  if (launch.exitCode !== 0 || !containerId) {
    throw new Error(`Could not start HTTP runner: ${launch.stderr || launch.stdout}`.trim());
  }

  const port = await runDocker(["port", containerId, `${input.containerPort}/tcp`]);
  const match = port.stdout.match(/:(\d+)\s*$/m);
  if (port.exitCode !== 0 || !match) {
    await runDocker(["rm", "-f", containerId]);
    throw new Error(`Could not determine runner port: ${port.stderr || port.stdout}`.trim());
  }
  const previewUrl = `http://127.0.0.1:${match[1]}`;
  let stopped = false;

  return {
    previewUrl,
    request: (probe) => requestAt(previewUrl, probe),
    async stop() {
      if (stopped) return { stdout: "", stderr: "" };
      stopped = true;
      const logs = await runDocker(["logs", containerId]);
      await runDocker(["rm", "-f", containerId]);
      return { stdout: logs.stdout, stderr: logs.stderr };
    },
  };
}

export async function waitForReadiness(run: ManagedRun, readiness: { path: string; expectedStatus: number }, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "service did not start";
  while (Date.now() < deadline) {
    try {
      const response = await run.request({ id: "readiness", method: "GET", path: readiness.path, expectedStatus: readiness.expectedStatus });
      if (response.status === readiness.expectedStatus) return;
      lastError = `readiness returned ${response.status}`;
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : "unknown readiness error";
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(lastError);
}

export async function runHttpProfile(input: {
  attemptId: string;
  sandboxPath: string;
  profile: Extract<ChallengeRuntimeProfile, { kind: "http" | "browser" }>;
  probes?: HttpProbe[];
}): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  let run: ManagedRun | undefined;
  const checks: RunCheckResult[] = [];
  let failure = "";
  try {
    run = await startHttpRun({ sandboxPath: input.sandboxPath, image: input.profile.image, command: input.profile.command, containerPort: input.profile.port });
    await waitForReadiness(run, input.profile.readiness, input.profile.timeoutMs);
    checks.push({ id: "readiness", passed: true, detail: "Service became ready." });
    for (const probe of input.probes ?? []) {
      const response = await run.request(probe);
      const passed = response.status === probe.expectedStatus;
      checks.push({ id: probe.id, passed, detail: `Expected ${probe.expectedStatus}; received ${response.status}.` });
    }
  } catch (cause) {
    failure = cause instanceof Error ? cause.message : "HTTP runner failed.";
    if (!checks.some((check) => check.id === "readiness")) {
      checks.push({ id: "readiness", passed: false, detail: failure });
    }
  } finally {
    const logs = run ? await run.stop() : { stdout: "", stderr: "" };
    return {
      attemptId: input.attemptId,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: failure || checks.some((check) => !check.passed) ? 1 : 0,
      stdout: logs.stdout,
      stderr: failure ? `${logs.stderr}${logs.stderr ? "\n" : ""}${failure}` : logs.stderr,
      checks,
    };
  }
}
