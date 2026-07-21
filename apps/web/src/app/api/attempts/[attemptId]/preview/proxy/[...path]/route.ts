import { proxyPreview } from "../route";

type Context = { params: Promise<{ attemptId: string; path: string[] }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: Context) {
  const { attemptId, path } = await params;
  return proxyPreview(request, { attemptId }, path.map(encodeURIComponent).join("/"));
}
