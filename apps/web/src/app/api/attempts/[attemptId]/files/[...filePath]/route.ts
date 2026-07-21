import { getAttempt } from "@/lib/attempts-store";
import { readSandboxFile, SandboxPathError } from "@/lib/sandbox";

type Context = { params: Promise<{ attemptId: string; filePath: string[] }> };

export async function GET(_request: Request, { params }: Context) {
  const { attemptId, filePath } = await params;
  const attempt = await getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });

  try {
    const path = filePath.join("/");
    const content = await readSandboxFile(attempt.sandboxPath, path);
    return Response.json({ path, content });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Unable to read sandbox file.";
    return Response.json(
      { error: detail },
      { status: cause instanceof SandboxPathError ? 400 : 404 },
    );
  }
}
