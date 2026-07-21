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

## Where Codex was used

Codex assisted with the initial challenge seed and the implementation roadmap
for the platform's build-and-evaluate loop, including:

- live SSE tool activity, sandbox path-jail/tool-loop tests, and fixed
  challenge-owned run and evaluation APIs;
- isolated Docker-backed `run_command` support with resource limits, a
  read-only filesystem, a writable attempt mount, scrubbed environment, and
  bounded time/output;
- the HTTP lifecycle and browser-runner design, deterministic submission and
  scoring flow, persistence and coaching boundaries, approved runner-image
  operations, and the local-to-Cloud Run architecture.

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
permissions.

## Migration and deployment

### Migrate incrementally

Keep the three backend choices independent so the application can move to cloud
in small, reversible steps:

1. Start locally with `ATTEMPT_REPOSITORY=json`, `WORKSPACE_BACKEND=local-fs`,
   and `RUNNER_BACKEND=docker`.
2. Create a Firestore database and deploy the app with
   `ATTEMPT_REPOSITORY=firestore`. Confirm that attempts, submitted results,
   tool events, run results, and coaching reports persist after a service
   restart.
3. Create a private Cloud Storage bucket and set
   `WORKSPACE_BACKEND=cloud-storage` plus `WORKSPACE_BUCKET`. New attempt
   workspaces are materialized for an operation and synced back to
   `workspaces/<race>/<attemptId>/` in the bucket.
4. When the runner image and sandbox permissions are ready, set
   `RUNNER_BACKEND=cloud-run-sandbox`. This currently supports isolated CLI
   commands; HTTP lifecycle execution and browser previews/acceptance remain
   local-runner features until their cloud workers are added.

Do not place service-account keys in `.env` or commit them. Local development
can use Application Default Credentials; deployed Cloud Run revisions should
use an attached service account with least-privilege access.

### Cloud Run demo deployment

A demo deployment consists of one Cloud Run service for the Next.js UI and API,
Firestore for attempt records, Cloud Storage for workspaces, Secret Manager for
`OPENAI_API_KEY`, and Cloud Run Sandboxes for supported execution commands.

Before deploying:

- Enable Cloud Run, Firestore, Cloud Storage, Artifact Registry, and Secret
  Manager for the Google Cloud project.
- Create a private workspace bucket and Firestore database in the intended
  region.
- Give the runtime service account only the Firestore and bucket permissions it
  needs, plus permission to read the OpenAI key secret.
- Build and publish the web image to Artifact Registry. The image used for a
  sandbox-enabled Cloud Run service must include the command-line tools needed
  by approved runner profiles, such as Node and npm.
- Configure the environment variables above and inject `OPENAI_API_KEY` from
  Secret Manager rather than a plain environment value.

Deploy the service with the Cloud Run sandbox launcher enabled (substitute your
region, project, repository, and image tag):

```bash
gcloud beta run deploy prompt-race-web \
  --image REGION-docker.pkg.dev/PROJECT/REPOSITORY/prompt-race-web:TAG \
  --sandbox-launcher
```

Then configure the service with `ATTEMPT_REPOSITORY=firestore`,
`WORKSPACE_BACKEND=cloud-storage`, `RUNNER_BACKEND=cloud-run-sandbox`,
`GOOGLE_CLOUD_PROJECT`, and `WORKSPACE_BUCKET`. Keep the sandbox network
restricted unless a challenge explicitly requires outbound access; never expose
the platform's API keys or production credentials to a contestant workspace.

### Deployment readiness checklist

- Verify that a new attempt is stored in Firestore and its workspace appears in
  the Cloud Storage bucket.
- Submit a CLI challenge and confirm that logs, checks, score, and coaching are
  persisted and visible after refreshing the UI.
- Set Cloud Run request and command timeouts to values appropriate for the
  challenge, with bounded runner output and cleanup enabled.
- Send structured logs and runner failures to Cloud Logging; add alerts for
  repeated failed runs and unexpected sandbox usage.
- Treat HTTP and browser execution as a separate rollout: they need a named
  sandbox lifecycle/preview service and a private browser-acceptance worker,
  which are not configured in the current cloud backend.

## Verification

```bash
pnpm --filter @prompt-race/shared typecheck
pnpm --filter @prompt-race/agent typecheck
pnpm --filter @prompt-race/scoring typecheck
pnpm --filter @prompt-race/web typecheck
```
