import { getAttempt } from "@/lib/attempts-store";
import { expirePreview, replacePreview } from "@/lib/preview-store";
import { getRuntimeProfile } from "@/lib/run-profiles";
import { startHttpRun, waitForReadiness } from "@/lib/runner/http-runner";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

const PREVIEW_LIFETIME_MS = 10 * 60_000;

/** Starts a short-lived, attempt-owned browser preview on a loopback-only port. */
export async function POST(_request: Request, { params }: Context) {
  const { attemptId } = await params;
  const attempt = getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "Attempt not found." }, { status: 404 });

  const profile = getRuntimeProfile(attempt.challengeId);
  if (!profile || profile.kind !== "browser") {
    return Response.json({ error: "This challenge does not support a browser preview." }, { status: 409 });
  }

  try {
    const run = await startHttpRun({
      sandboxPath: attempt.sandboxPath,
      image: profile.image,
      command: profile.command,
      containerPort: profile.port,
    });
    try {
      await waitForReadiness(run, profile.readiness, profile.timeoutMs);
    } catch (cause) {
      await run.stop();
      throw cause;
    }
    const expiresAt = new Date(Date.now() + PREVIEW_LIFETIME_MS).toISOString();
    await replacePreview({ attemptId, previewUrl: run.previewUrl, expiresAt, run });
    setTimeout(() => { void expirePreview(attemptId); }, PREVIEW_LIFETIME_MS);
    return Response.json({ previewUrl: `/api/attempts/${attemptId}/preview/proxy`, expiresAt });
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Could not start preview." },
      { status: 502 },
    );
  }
}
