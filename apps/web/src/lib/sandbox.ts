import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export {
  listSandboxFiles,
  readSandboxFile,
  resolveInSandbox,
  SandboxPathError,
  writeSandboxFile,
} from "./sandbox-fs";

// From apps/web, monorepo root is two levels up when cwd is apps/web.
// Prefer an absolute root via env in production:
const ROOT = process.env.SANDBOX_ROOT ?? path.join(process.cwd(), "sandboxes");

export function sandboxPathFor(raceId: string, attemptId: string) {
  return path.join(ROOT, raceId, attemptId);
}

const STATIC_SERVER = `import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const mime = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
http.createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) && file !== root) return response.writeHead(403).end();
  try {
    if (!(await stat(file)).isFile()) throw new Error("Not a file");
    response.setHeader("content-type", mime[path.extname(file)] ?? "application/octet-stream");
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(3000, "0.0.0.0");
`;

export async function createSandbox(raceId: string, attemptId: string, challengeId: string) {
  const dir = sandboxPathFor(raceId, attemptId);
  await mkdir(dir, { recursive: true });
  const runContract = challengeId === "hello-http" || challengeId === "notes-api"
    ? "\n\n## Platform run contract\n\nUse `npm run start`. The server must listen on port 3000 and accept connections on `0.0.0.0`.\n"
    : challengeId === "reading-list"
      ? "\n\n## Platform run contract\n\nUse `npm run start`. The included static server serves `index.html` on port 3000. Build this challenge with browser-native HTML, CSS, and JavaScript; do not add framework dependencies.\n"
      : "";
  await writeFile(
    path.join(dir, "README.md"),
    `# Attempt ${attemptId}\n\nChallenge: ${challengeId}\nBuilder writes files here.${runContract}`,
    "utf8",
  );
  if (challengeId === "hello-http" || challengeId === "notes-api" || challengeId === "reading-list") {
    const packagePath = path.join(dir, "package.json");
    await writeFile(
      packagePath,
      `${JSON.stringify({
        name: challengeId,
        private: true,
        ...(challengeId === "reading-list" ? { type: "module" } : {}),
        scripts: { start: "node server.js" },
      }, null, 2)}\n`,
      "utf8",
    );
    if (challengeId === "reading-list") {
      await writeFile(path.join(dir, "server.js"), STATIC_SERVER, "utf8");
    }
  }
  return dir;
}
