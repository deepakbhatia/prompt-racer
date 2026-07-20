import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SandboxPathError, resolveInSandbox, writeSandboxFile } from "./sandbox-fs";

test("rejects traversal and absolute paths", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "prompt-race-sandbox-"));
  try {
    await assert.rejects(() => resolveInSandbox(root, "../outside.txt"), SandboxPathError);
    await assert.rejects(() => resolveInSandbox(root, "/etc/passwd"), SandboxPathError);
    await assert.rejects(() => resolveInSandbox(root, "bad\\0path"), SandboxPathError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a symlink that points outside the sandbox", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "prompt-race-sandbox-"));
  const outside = await mkdtemp(path.join(tmpdir(), "prompt-race-outside-"));
  try {
    await symlink(outside, path.join(root, "escape"));
    await assert.rejects(() => writeSandboxFile(root, "escape/stolen.txt", "no"), SandboxPathError);
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});