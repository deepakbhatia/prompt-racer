import { Firestore } from "@google-cloud/firestore";
import { randomUUID } from "node:crypto";
import type { EvaluationResult, PostRunAnalysis, RaceAttempt, RunResult } from "@prompt-race/shared";
import { sandboxPathFor } from "./sandbox";
import type { AttemptRepository, StoredToolEvent } from "./attempt-repository";

type PersistedAttempt = Omit<RaceAttempt, "sandboxPath"> & { toolEventCount?: number };

function durable(attempt: RaceAttempt): PersistedAttempt {
  const { sandboxPath: _runtimeOnlyPath, ...record } = attempt;
  return record;
}

function hydrate(record: PersistedAttempt): RaceAttempt {
  const { toolEventCount: _toolEventCount, ...attempt } = record;
  return { ...attempt, sandboxPath: sandboxPathFor(attempt.raceId, attempt.id) };
}

/** Firestore implementation for Cloud Run and shared development environments. */
export class FirestoreAttemptRepository implements AttemptRepository {
  private readonly db: Firestore;

  constructor(db?: Firestore) {
    this.db = db ?? new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
  }

  private attempt(id: string) { return this.db.collection("attempts").doc(id); }

  async create(attempt: RaceAttempt) { await this.attempt(attempt.id).create(durable(attempt)); }
  async get(id: string) {
    const snapshot = await this.attempt(id).get();
    return snapshot.exists ? hydrate(snapshot.data() as PersistedAttempt) : undefined;
  }
  async update(id: string, patch: Partial<RaceAttempt>) {
    const ref = this.attempt(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return undefined;
    const { sandboxPath: _runtimeOnlyPath, ...durablePatch } = patch;
    await ref.update(durablePatch);
    return hydrate({ ...(snapshot.data() as PersistedAttempt), ...durablePatch });
  }
  async submit(id: string) {
    const ref = this.attempt(id);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() as PersistedAttempt | undefined;
      if (!snapshot.exists || current?.status !== "running") return undefined;
      const submittedAt = new Date().toISOString();
      transaction.update(ref, { status: "submitted", submittedAt });
      return hydrate({ ...current, status: "submitted", submittedAt });
    });
  }
  async appendToolEvent(id: string, event: Omit<StoredToolEvent, "sequence" | "at">) {
    const ref = this.attempt(id);
    await this.db.runTransaction(async (transaction) => {
      const attempt = await transaction.get(ref);
      if (!attempt.exists) throw new Error("Attempt not found.");
      const sequence = Number(attempt.data()?.toolEventCount ?? 0);
      transaction.update(ref, { toolEventCount: sequence + 1 });
      transaction.create(ref.collection("toolEvents").doc(String(sequence).padStart(8, "0")), {
        ...event,
        sequence,
        at: new Date().toISOString(),
      });
    });
  }
  async saveRun(result: RunResult) {
    await this.attempt(result.attemptId).collection("runResults").doc(randomUUID()).create(result);
  }
  async saveEvaluation(id: string, result: EvaluationResult) { await this.attempt(id).update({ evaluation: result }); }
  async savePostRunAnalysis(id: string, analysis: PostRunAnalysis) {
    await this.attempt(id).update({ postRunAnalysis: analysis });
  }
  async getToolEvents(id: string) {
    const snapshot = await this.attempt(id).collection("toolEvents").orderBy("sequence").get();
    return snapshot.docs.map((document) => document.data() as StoredToolEvent);
  }
  async getRunResults(id: string) {
    const snapshot = await this.attempt(id).collection("runResults").orderBy("startedAt").get();
    return snapshot.docs.map((document) => document.data() as RunResult);
  }
}
