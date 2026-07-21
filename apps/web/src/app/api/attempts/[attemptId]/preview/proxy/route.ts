import { getPreview } from "@/lib/preview-store";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: Context) {
  return proxyPreview(request, await params, "");
}

export async function proxyPreview(request: Request, { attemptId }: { attemptId: string }, suffix: string) {
  const preview = getPreview(attemptId);
  if (!preview) return Response.json({ error: "Preview is unavailable or expired." }, { status: 404 });

  const requestUrl = new URL(request.url);
  const target = new URL(`${preview.previewUrl}/${suffix}`);
  target.search = requestUrl.search;
  try {
    const upstream = await fetch(target, { redirect: "manual" });
    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Preview proxy failed." },
      { status: 502 },
    );
  }
}
