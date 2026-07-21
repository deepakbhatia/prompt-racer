# Prompt Race

Competitive benchmarking for **AI-assisted development**. Developers race to
ship working apps using natural-language prompts while Prompt Race measures
functional quality, speed, and prompt efficiency.

Prompt Race is built for developer education and training: every attempt makes
the prompt trace, generated files, tool activity, runtime output, deterministic
checks, score, and post-run coaching visible in one loop.

## How it works

```text
Choose challenge → prompt the builder → inspect code → run → submit → learn
                         │                                  │
                         ▼                                  ▼
              scope guard + GPT-5.6 tools          checks + scoring + coaching
```

GPT-5.6 has separate roles:

| Role | Responsibility |
|---|---|
| Builder | Reads, writes, and optionally runs files in one isolated attempt workspace. |
| Scope guard | Blocks out-of-scope or leak-seeking prompts before they reach the builder. |
| Evaluator | Interprets deterministic check evidence and writes functional notes. |
| Coach | Produces post-run improvement feedback without affecting the score. |

The score is deterministic. It combines functional completion with elapsed time
and prompt efficiency (tokens and turns). Model feedback never overrides a
failed platform-owned check.

## Current capabilities

- Public challenge catalogue: CLI, HTTP API, and browser-app exercises.
- Expandable challenge cards and isolated workspaces per attempt.
- GPT-5.6 builder tool loop with `list_files`, `read_file`, `write_file`, and
  optional isolated `run_command`.
- Path-jail protection against traversal, absolute paths, null bytes, and
  symlink escapes.
- Read-only code browser with syntax highlighting and a file tree.
- Platform-owned CLI and HTTP run profiles with readiness checks and captured
  output.
- Submission lock, deterministic checks, scoring, evaluator notes, and
  post-run coaching.
- Home dashboard comparing submitted challenge result, score, functional
  quality, checks, time, prompt turns, and tokens.
- Local JSON persistence by default; optional Firestore and Cloud Storage
  backends behind repository/workspace interfaces.
- Docker runner images, digest enforcement for production, and image CI
  scaffolding.

## Important limitations

- Browser challenges currently have a static preview runner, but do **not** pass
  submission until the private Playwright acceptance worker is implemented.
- Cloud Run Sandbox execution currently supports the short CLI command path.
  Cloud HTTP lifecycle and browser preview runners still need the named-sandbox
  implementation.
- The local JSON attempt store is for development only. Use Firestore for a
  shared or Cloud Run deployment.

## Repository layout

```text
apps/web                 Next.js UI, routes, workspace, runners, persistence adapters
packages/agent           GPT-5.6 role prompts, tool loop, and agent interfaces
packages/challenges      Public challenge briefs
packages/scoring         Deterministic speed and prompt-efficiency scoring
packages/shared          Shared domain types
containers/              Approved runner-image definitions and operations notes
scripts/                 Runner-host maintenance scripts
```

Generated contestant work is stored only in attempt workspaces under
`sandboxes/` locally, or in Cloud Storage for the cloud workspace backend.

## Local quick start

Requirements: Node.js 20+, pnpm, Docker Desktop for isolated challenge runs,
and an OpenAI API key for real GPT-5.6 behavior.

```bash
pnpm install
cp .env.example apps/web/.env.local
pnpm dev
```

Set at least these values in `apps/web/.env.local`:

```dotenv
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6
SANDBOX_ROOT=/absolute/path/to/this-repo/sandboxes
SANDBOX_RUNNER=docker

ATTEMPT_REPOSITORY=json
WORKSPACE_BACKEND=local-fs
RUNNER_BACKEND=docker
```

Open [http://localhost:3000](http://localhost:3000).

Without `OPENAI_API_KEY`, Prompt Race uses stub agents for UI development.

## Challenge workflow

1. Select a challenge and start a workspace.
2. Send focused natural-language prompts to the builder.
3. Inspect generated files and run the platform-owned profile while iterating.
4. Submit to lock the attempt and run deterministic checks.
5. Review score, evaluator notes, and post-run coaching.

For HTTP challenges, new workspaces include a public `npm run start` contract.
For the Reading List browser challenge, the starter uses a dependency-free Node
static server and `index.html`; it does not require Vite or `npm install`.

## Persistence and execution backends

These values are server-side only:

| Concern | Local development | Cloud demo |
|---|---|---|
| Attempts | `ATTEMPT_REPOSITORY=json` | `ATTEMPT_REPOSITORY=firestore` |
| Workspaces | `WORKSPACE_BACKEND=local-fs` | `WORKSPACE_BACKEND=cloud-storage` |
| Execution | `RUNNER_BACKEND=docker` | `RUNNER_BACKEND=cloud-run-sandbox` |

Cloud mode also requires `GOOGLE_CLOUD_PROJECT` and `WORKSPACE_BUCKET` plus a
Cloud Run service account with the minimum required Firestore and Cloud Storage
permissions. See [guide-sandbox-tools.md](guide-sandbox-tools.md#19-dual-local-and-cloud-run-development-environments)
for the migration and deployment guide.

## Verification

```bash
pnpm --filter @prompt-race/shared typecheck
pnpm --filter @prompt-race/agent typecheck
pnpm --filter @prompt-race/scoring typecheck
pnpm --filter @prompt-race/web typecheck
```

## Project story

See [PROJECT_STORY.md](PROJECT_STORY.md) for the developer-education-focused
submission narrative.

See [AGENTS.md](AGENTS.md) for repository conventions and safety boundaries.
