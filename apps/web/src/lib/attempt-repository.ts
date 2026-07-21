import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvaluationResult, PostRunAnalysis, RaceAttempt, RunResult } from "@prompt-race/shared";
import { sandboxPathFor } from "./sandbox";

export interface StoredToolEvent {
  sequence: number;
  type: "tool_start" | "tool_end" | "tool_error";
  name: string;
  path?: string;
  bytes?: number;
  error?: string;
  at: string;
}

export interface AttemptRepository {
  create(attempt: RaceAttempt): Promise<void>;
  get(id: string): Promise<RaceAttempt | undefined>;
  update(id: string, patch: Partial<RaceAttempt>): Promise<RaceAttempt | undefined>;
  submit(id: string): Promise<RaceAttempt | undefined>;
  appendToolEvent(id: string, event: Omit<StoredToolEvent, "sequence" | "at">): Promise<void>;
  saveRun(result: RunResult): Promise<void>;
  saveEvaluation(id: string, result: EvaluationResult): Promise<void>;
  savePostRunAnalysis(id: string, analysis: PostRunAnalysis): Promise<void>;
  getToolEvents(id: string): Promise<StoredToolEvent[]>;
  getRunResults(id: string): Promise<RunResult[]>;
}

type PersistedAttempt = Omit<RaceAttempt, "sandboxPath">;
type RepositoryData = {
  version: 1;
  attempts: Record<string, PersistedAttempt>;
  toolEvents: Record<string, StoredToolEvent[]>;
  runResults: Record<string, RunResult[]>;
};

function emptyData(): RepositoryData {
  return { version: 1, attempts: {}, toolEvents: {}, runResults: {} };
}

function toPersisted(attempt: RaceAttempt): PersistedAttempt {
  const { sandboxPath: _sandboxPath, ...persisted } = attempt;
  return persisted;
}

function hydrate(attempt: PersistedAttempt): RaceAttempt {
  return { ...attempt, sandboxPath: sandboxPathFor(attempt.raceId, attempt.id) };
}

/** Useful for route tests and isolated unit tests. */
export class InMemoryAttemptRepository implements AttemptRepository {
  private readonly attempts = new Map<string, RaceAttempt>();
  private readonly events = new Map<string, StoredToolEvent[]>();
  private readonly runs = new Map<string, RunResult[]>();

  async create(attempt: RaceAttempt) { this.attempts.set(attempt.id, attempt); }
  async get(id: string) { return this.attempts.get(id); }
  async update(id: string, patch: Partial<RaceAttempt>) {
    const current = this.attempts.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    this.attempts.set(id, next);
    return next;
  }
  async submit(id: string) {
    const current = this.attempts.get(id);
    if (!current || current.status !== "running") return undefined;
    return this.update(id, { status: "submitted", submittedAt: new Date().toISOString() });
  }
  async appendToolEvent(id: string, event: Omit<StoredToolEvent, "sequence" | "at">) {
    const events = this.events.get(id) ?? [];
    events.push({ ...event, sequence: events.length, at: new Date().toISOString() });
    this.events.set(id, events);
  }
  async saveRun(result: RunResult) {
    this.runs.set(result.attemptId, [...(this.runs.get(result.attemptId) ?? []), result]);
  }
  async saveEvaluation(id: string, result: EvaluationResult) { await this.update(id, { evaluation: result }); }
  async savePostRunAnalysis(id: string, analysis: PostRunAnalysis) {
    await this.update(id, { postRunAnalysis: analysis });
  }
  async getToolEvents(id: string) { return [...(this.events.get(id) ?? [])]; }
  async getRunResults(id: string) { return [...(this.runs.get(id) ?? [])]; }
}

/**
 * Development persistence with atomic file replacement. It is intentionally a
 * single-process implementation; use a database repository with transactions
 * when deploying multiple web/runner replicas.
 */
export class JsonFileAttemptRepository implements AttemptRepository {
  private data: RepositoryData | undefined;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load() {
    if (this.data) return this.data;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as RepositoryData;
      this.data = parsed.version === 1 ? parsed : emptyData();
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
      this.data = emptyData();
    }
    return this.data;
  }

  private async mutate<T>(operation: (data: RepositoryData) => T): Promise<T> {
    let result!: T;
    const write = this.writes.then(async () => {
      const data = await this.load();
      result = operation(data);
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(tempPath, JSON.stringify(data), "utf8");
      await rename(tempPath, this.filePath);
    });
    this.writes = write.catch(() => undefined);
    await write;
    return result;
  }

  async create(attempt: RaceAttempt) {
    await this.mutate((data) => { data.attempts[attempt.id] = toPersisted(attempt); });
  }
  async get(id: string) {
    await this.writes;
    const attempt = (await this.load()).attempts[id];
    return attempt ? hydrate(attempt) : undefined;
  }
  async update(id: string, patch: Partial<RaceAttempt>) {
    return this.mutate((data) => {
      const current = data.attempts[id];
      if (!current) return undefined;
      // sandboxPath is runtime-only and is deliberately never written to disk.
      const { sandboxPath: _sandboxPath, ...durablePatch } = patch;
      const next = { ...current, ...durablePatch } as PersistedAttempt;
      data.attempts[id] = next;
      return hydrate(next);
    });
  }
  async submit(id: string) {
    return this.mutate((data) => {
      const current = data.attempts[id];
      if (!current || current.status !== "running") return undefined;
      const next = { ...current, status: "submitted" as const, submittedAt: new Date().toISOString() };
      data.attempts[id] = next;
      return hydrate(next);
    });
  }
  async appendToolEvent(id: string, event: Omit<StoredToolEvent, "sequence" | "at">) {
    await this.mutate((data) => {
      const events = data.toolEvents[id] ?? [];
      events.push({ ...event, sequence: events.length, at: new Date().toISOString() });
      data.toolEvents[id] = events;
    });
  }
  async saveRun(result: RunResult) {
    await this.mutate((data) => {
      data.runResults[result.attemptId] = [...(data.runResults[result.attemptId] ?? []), result];
    });
  }
  async saveEvaluation(id: string, result: EvaluationResult) {
    await this.update(id, { evaluation: result });
  }
  async savePostRunAnalysis(id: string, analysis: PostRunAnalysis) {
    await this.update(id, { postRunAnalysis: analysis });
  }
  async getToolEvents(id: string) {
    await this.writes;
    return [...((await this.load()).toolEvents[id] ?? [])];
  }
  async getRunResults(id: string) {
    await this.writes;
    return [...((await this.load()).runResults[id] ?? [])];
  }
}

function developmentRepositoryPath() {
  return process.env.ATTEMPT_STORE_PATH ?? path.join(process.cwd(), ".runs", "attempts.json");
}

declare global {
  var promptRaceAttemptRepository: AttemptRepository | undefined;
}

export function getAttemptRepository(): AttemptRepository {
  if (!globalThis.promptRaceAttemptRepository) {
    globalThis.promptRaceAttemptRepository = process.env.ATTEMPT_REPOSITORY === "memory"
      ? new InMemoryAttemptRepository()
      : new JsonFileAttemptRepository(developmentRepositoryPath());
  }
  return globalThis.promptRaceAttemptRepository;
}
