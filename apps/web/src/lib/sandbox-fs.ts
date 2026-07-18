import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export class SandboxPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxPathError";
  }
}

function isWithin(root: string, candidate: string) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function validateRelativePath(relativePath: string) {
  if (!relativePath || relativePath.includes("\0")) {
    throw new SandboxPathError("Path is required and cannot contain null bytes.");
  }
  if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new SandboxPathError("Absolute paths are not allowed.");
  }
  if (relativePath.split(/[\\/]+/).includes("..")) {
    throw new SandboxPathError("Parent-directory traversal is not allowed.");
  }
}

async function canonicalSandboxRoot(sandboxRoot: string) {
  await mkdir(sandboxRoot, { recursive: true });
  return realpath(sandboxRoot);
}

/** Returns the nearest existing ancestor of a path, resolved through symlinks. */
async function realExistingAncestor(candidate: string) {
  let ancestor = candidate;
  while (true) {
    try {
      return await realpath(ancestor);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw cause;
      ancestor = parent;
    }
  }
}

/**
 * Resolves a model-supplied relative path inside one attempt's sandbox.
 * Existing files and parents are canonicalized so a symlink cannot escape
 * the sandbox root.
 */
export async function resolveInSandbox(sandboxRoot: string, relativePath: string) {
  validateRelativePath(relativePath);

  const root = await canonicalSandboxRoot(sandboxRoot);
  const candidate = path.resolve(root, relativePath);
  if (!isWithin(root, candidate)) {
    throw new SandboxPathError("Path escapes the sandbox.");
  }

  const canonicalAncestor = await realExistingAncestor(candidate);
  if (!isWithin(root, canonicalAncestor)) {
    throw new SandboxPathError("Path resolves outside the sandbox through a symlink.");
  }

  try {
    const canonicalPath = await realpath(candidate);
    if (!isWithin(root, canonicalPath)) {
      throw new SandboxPathError("Path resolves outside the sandbox through a symlink.");
    }
    return canonicalPath;
  } catch (cause) {
    if (cause instanceof SandboxPathError) throw cause;
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
    return candidate;
  }
}

export async function listSandboxFiles(sandboxRoot: string, relativeDirectory = ".") {
  const directory = await resolveInSandbox(sandboxRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .sort();
}

export async function readSandboxFile(
  sandboxRoot: string,
  relativePath: string,
  maxBytes = 200_000,
) {
  const file = await resolveInSandbox(sandboxRoot, relativePath);
  const details = await stat(file);
  if (!details.isFile()) throw new SandboxPathError("Path is not a file.");
  if (details.size > maxBytes) throw new SandboxPathError(`File exceeds ${maxBytes} bytes.`);
  return readFile(file, "utf8");
}

export async function writeSandboxFile(
  sandboxRoot: string,
  relativePath: string,
  contents: string,
) {
  if (Buffer.byteLength(contents, "utf8") > 1_000_000) {
    throw new SandboxPathError("File contents exceed 1 MB.");
  }

  let file = await resolveInSandbox(sandboxRoot, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  // Re-resolve after mkdir so newly encountered parent directories cannot be symlinks.
  file = await resolveInSandbox(sandboxRoot, relativePath);
  await writeFile(file, contents, "utf8");

  return {
    path: relativePath.replaceAll("\\", "/"),
    bytes: Buffer.byteLength(contents, "utf8"),
  };
}
