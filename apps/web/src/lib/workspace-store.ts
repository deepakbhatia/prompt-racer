import { Storage } from "@google-cloud/storage";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSandbox, listSandboxFiles, readSandboxFile, sandboxPathFor, writeSandboxFile } from "./sandbox";

export interface WorkspaceStore {
  create(sandboxRef: string, challengeId: string): Promise<string>;
  withWorkspace<T>(sandboxRef: string, action: (sandboxPath: string) => Promise<T>): Promise<T>;
  list(sandboxRef: string, directory?: string): Promise<string[]>;
  read(sandboxRef: string, relativePath: string): Promise<string>;
}

function splitSandboxRef(sandboxRef: string) {
  const parts = sandboxRef.split("/");
  if (parts.length !== 2 || parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) {
    throw new Error("Invalid sandbox reference.");
  }
  const [raceId, attemptId] = parts as [string, string];
  return { raceId, attemptId };
}

async function listRecursively(sandboxPath: string, directory = "."): Promise<string[]> {
  const entries = await listSandboxFiles(sandboxPath, directory);
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = directory === "." ? entry : `${directory}/${entry}`;
    if (entry.endsWith("/")) files.push(...await listRecursively(sandboxPath, relativePath.slice(0, -1)));
    else files.push(relativePath);
  }
  return files;
}

export class LocalFilesystemWorkspaceStore implements WorkspaceStore {
  async create(sandboxRef: string, challengeId: string) {
    const { raceId, attemptId } = splitSandboxRef(sandboxRef);
    return createSandbox(raceId, attemptId, challengeId);
  }
  async withWorkspace<T>(sandboxRef: string, action: (sandboxPath: string) => Promise<T>) {
    const { raceId, attemptId } = splitSandboxRef(sandboxRef);
    return action(sandboxPathFor(raceId, attemptId));
  }
  async list(sandboxRef: string, directory = ".") {
    return this.withWorkspace(sandboxRef, (sandboxPath) => listSandboxFiles(sandboxPath, directory));
  }
  async read(sandboxRef: string, relativePath: string) {
    return this.withWorkspace(sandboxRef, (sandboxPath) => readSandboxFile(sandboxPath, relativePath));
  }
}

/**
 * Object storage is used as durable workspace state. Each request receives an
 * isolated temporary directory; only safe relative paths are copied into it.
 */
export class CloudStorageWorkspaceStore implements WorkspaceStore {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(options?: { storage?: Storage; bucketName?: string }) {
    this.storage = options?.storage ?? new Storage();
    this.bucketName = options?.bucketName ?? process.env.WORKSPACE_BUCKET ?? "";
    if (!this.bucketName) throw new Error("WORKSPACE_BUCKET is required for cloud-storage workspaces.");
  }

  private prefix(sandboxRef: string) {
    const { raceId, attemptId } = splitSandboxRef(sandboxRef);
    return `workspaces/${raceId}/${attemptId}/`;
  }

  async create(sandboxRef: string, challengeId: string) {
    return this.withWorkspace(sandboxRef, async (sandboxPath) => {
      await writeSandboxFile(sandboxPath, "README.md", `# Attempt ${sandboxRef}\n\nChallenge: ${challengeId}\nBuilder writes files here.\n`);
      return sandboxPath;
    });
  }

  async withWorkspace<T>(sandboxRef: string, action: (sandboxPath: string) => Promise<T>): Promise<T> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "prompt-race-workspace-"));
    try {
      await this.download(sandboxRef, directory);
      const result = await action(directory);
      await this.upload(sandboxRef, directory);
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async list(sandboxRef: string, directory = ".") {
    return this.withWorkspace(sandboxRef, (sandboxPath) => listSandboxFiles(sandboxPath, directory));
  }

  async read(sandboxRef: string, relativePath: string) {
    return this.withWorkspace(sandboxRef, (sandboxPath) => readSandboxFile(sandboxPath, relativePath));
  }

  private async download(sandboxRef: string, directory: string) {
    const prefix = this.prefix(sandboxRef);
    const [files] = await this.storage.bucket(this.bucketName).getFiles({ prefix });
    await Promise.all(files.map(async (file) => {
      const relativePath = file.name.slice(prefix.length);
      if (!relativePath || relativePath.endsWith("/")) return;
      const [contents] = await file.download();
      await writeSandboxFile(directory, relativePath, contents.toString("utf8"));
    }));
  }

  private async upload(sandboxRef: string, directory: string) {
    const prefix = this.prefix(sandboxRef);
    const files = await listRecursively(directory);
    await Promise.all(files.map(async (relativePath) =>
      this.storage.bucket(this.bucketName).file(`${prefix}${relativePath}`).save(
        await readSandboxFile(directory, relativePath),
        { resumable: false, contentType: "application/octet-stream" },
      ),
    ));
  }
}

declare global {
  var promptRaceWorkspaceStore: WorkspaceStore | undefined;
}

export function getWorkspaceStore(): WorkspaceStore {
  if (!globalThis.promptRaceWorkspaceStore) {
    globalThis.promptRaceWorkspaceStore = process.env.WORKSPACE_BACKEND === "cloud-storage"
      ? new CloudStorageWorkspaceStore()
      : new LocalFilesystemWorkspaceStore();
  }
  return globalThis.promptRaceWorkspaceStore;
}
