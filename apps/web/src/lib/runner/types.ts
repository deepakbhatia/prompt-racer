import type { RunCheckResult } from "@prompt-race/shared";

export interface HttpProbe {
  id: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  expectedStatus: number;
}

export type CheckResult = RunCheckResult;

export interface ManagedRun {
  readonly previewUrl: string;
  request(probe: HttpProbe): Promise<{ status: number; body: string }>;
  stop(): Promise<{ stdout: string; stderr: string }>;
}
