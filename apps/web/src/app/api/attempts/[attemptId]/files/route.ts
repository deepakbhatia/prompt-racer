import { getAttempt } from "@/lib/attempts-store";
import { listSandboxFiles } from "@/lib/sandbox";

type Context = { params: Promise<{ attemptId: string }> };

async function collectFiles(sandboxPath: string, directory = "."): Promise<string[]> {
  const entries = await listSandboxFiles(sandboxPath, directory);
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = directory === "." ? entry : `${directory}/${entry}`;
    if (entry.endsWith("/")) {
      files.push(...(await collectFiles(sandboxPath, relativePath.slice(0, -1))));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

export async function GET(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = await getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });

  try {
    return Response.json({ files: await collectFiles(attempt.sandboxPath) });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Unable to list sandbox files.";
    return Response.json({ error: detail }, { status: 500 });
  }
}
