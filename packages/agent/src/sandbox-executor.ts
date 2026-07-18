export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SandboxExecutor {
  listFiles(path?: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<{ path: string; bytes: number }>;
  runCommand?(command: string, args?: string[]): Promise<RunCommandResult>;
}

export async function executeBuilderTool(
  name: string,
  argsJson: string,
  executor: SandboxExecutor,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    const args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
    switch (name) {
      case "list_files": {
        const path = typeof args.path === "string" ? args.path : ".";
        return { ok: true, result: await executor.listFiles(path) };
      }
      case "read_file": {
        if (typeof args.path !== "string") return { ok: false, error: "path required" };
        return { ok: true, result: await executor.readFile(args.path) };
      }
      case "write_file": {
        if (typeof args.path !== "string" || typeof args.content !== "string") {
          return { ok: false, error: "path and content required" };
        }
        return { ok: true, result: await executor.writeFile(args.path, args.content) };
      }
      case "run_command": {
        if (!executor.runCommand) return { ok: false, error: "run_command disabled" };
        if (typeof args.command !== "string") return { ok: false, error: "command required" };
        const cmdArgs = Array.isArray(args.args)
          ? args.args.filter((a): a is string => typeof a === "string")
          : [];
        return { ok: true, result: await executor.runCommand(args.command, cmdArgs) };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}