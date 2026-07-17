# Prompt Race

Competitive benchmarking for **AI-assisted development**. Contestants race to ship working apps using only natural-language prompts. The platform uses **GPT-5.6** as:

| Role | Job |
|------|-----|
| **Builder** | Turns prompts into code inside an isolated sandbox |
| **Scope guard** | Blocks out-of-scope / leak-seeking requests |
| **Evaluator** | Checks acceptance criteria and writes scoring notes |

Leaderboards weigh **speed** and **prompt efficiency** (tokens + turns), not raw completion alone.

## Monorepo layout

```
apps/web                 Next.js UI (lobby, races, challenges)
packages/shared          Domain types (Challenge, Race, Evaluation)
packages/agent           GPT-5.6 role prompts + stub client
packages/scoring         Speed + efficiency composite score
packages/challenges      Public challenge briefs (imported by app)
challenges/*/golden/     Private evaluator assets (ignored)
sandboxes/               Ephemeral attempt workspaces (ignored)
```

## Ignore files (token hygiene)

| File | Purpose |
|------|---------|
| `.gitignore` | Keep deps, builds, sandboxes, secrets out of git |
| `.codexignore` | Same patterns for Codex-oriented workflows |
| `.dockerignore` | Slim images — no `node_modules` / sandboxes |

Agents should load **source + public challenge specs**, not `node_modules`, lockfiles, `.next`, or per-heat sandboxes.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Next implementation slices

1. Wire `packages/agent` to the OpenAI API (`OPENAI_API_KEY`, model `gpt-5.6`)
2. Race session API: create attempt → scope-guard → builder loop → submit
3. Sandbox runner (isolated cwd under `sandboxes/`)
4. Automated acceptance checks + `packages/scoring` on the leaderboard
5. Auth / heat lobby / live spectator view

See `AGENTS.md` for conventions when coding agents work in this repo.
