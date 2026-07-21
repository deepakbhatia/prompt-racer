import { getAttempt } from "@/lib/attempts-store";
import { getWorkspaceStore } from "@/lib/workspace-store";

type Context = { params: Promise<{ attemptId: string }> };

async function collectFiles(sandboxRef: string, directory = "."): Promise<string[]> {
  const entries = await getWorkspaceStore().list(sandboxRef, directory);
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = directory === "." ? entry : `${directory}/${entry}`;
    if (entry.endsWith("/")) {
      files.push(...(await collectFiles(sandboxRef, relativePath.slice(0, -1))));
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
    return Response.json({ files: await collectFiles(attempt.sandboxRef) });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Unable to list sandbox files.";
    return Response.json({ error: detail }, { status: 500 });
  }
}
