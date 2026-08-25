# dsh-grad-workbench

> **Graduate OS / 硕博工作台** — a local-first DeepSeek Harness workbench that turns graduate-school tasks into composable Skills, Workflows, Memory and Connectors.

## Status

Implemented per `docs/DSH_DEVELOPMENT_PLAN.md` phases 0–9 plus the seams for
10–11; see `docs/PROGRESS.md` for the live checklist. **63/63 automated tests
pass** (`npm test`) on Windows + Node 24 against DSH `@deepseek-ai/dsh@0.1.1-rc.2`.

| Space | What works today |
|---|---|
| Research | Latest-papers radar over OpenAlex (+S2 enrichment), DOI/OA/S2/fingerprint dedup, deterministic evidence-tagged cited report, Feishu publish behind approval |
| Communication | Advisor-message understanding (scenario/intent/risk/commitments), tone-varied reply drafts with no-invented-progress placeholders, drafts saved as artifacts |
| Life | Food Map capture → unresolved queue → user-confirmed pins; volunteer hours ledger with month/org totals and CSV export; workout logging with per-exercise sets and last-workout lookup |
| Automation | Universal inbox + router, workflow run history, Skill Studio recipe composition over atomic skills, Form Assistant vault + two-gate fill/submit |
| Foundations | Scoped memory (FTS5+CJK fallback, candidates, supersession, sensitivity), approval service (payload-hash bound, single-consume), artifact store (sha256), connector registry |

Known deferred items (require user decisions): TTS provider for audio files,
real Feishu credentials for live publish smoke, WeChat bridge endpoint. All are
documented in `docs/PROGRESS.md` § Known deferred items.

## Install (isolated `grad` profile)

```powershell
# 1. clone
git clone https://github.com/John030427/dsh-grad-workbench C:\Users\Administrator\Projects\dsh-grad-workbench
cd C:\Users\Administrator\Projects\dsh-grad-workbench
npm install && npm run build && npm test

# 2. profile (~\.dsh\profiles\grad\package.json)
{
  "name": "dsh-profile-grad",
  "private": true,
  "dsh": { "profile": { "bundles": [
    "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-grad-workbench"
  ] } },
  "dependencies": {
    "dsh-grad-workbench": "link:C:/Users/Administrator/Projects/dsh-grad-workbench"
  }
}
# junction: ~\.dsh\profiles\grad\node_modules\dsh-grad-workbench -> repo dir

# 3. boot + verify
node <dsh-checkout>\node_modules\@deepseek-ai\dsh\lib\bin.js --profile grad --port 3081 --no-open
node scripts/smoke.mjs 3081
```

Headless agent smoke uses the same bin with
`--profile grad-headless "<task mentioning grad_* tools>"`; that profile adds
the `dsh-webserver-shim` bundle so HTTP-less runs still load every tool.

## Architecture in one screen

```text
input → grad_capture → task router → Workflow (steps = skills)
      → tools + scoped Memory + model policy → Artifact (sha256)
      → ApprovalService gate when side effects exist → Connector (Feishu CLI)
Host owns SQLite/artifacts/runs/approvals/memory; client is a projection.
```

- Host: `src/host` — services, research providers, connectors, tools (`grad_*`),
  routes `/api/grad/*`.
- Client: `src/client` — one session-view tab「硕博工作台」(Home, Research,
  Communication, Life, Automation, Memory, Connections).
- Skills: `src/host/skills/catalog.ts` + Skill Studio compiler.
- Contracts & compatibility facts: `docs/COMPATIBILITY.md`. Resumable
  engineering log: `docs/PROGRESS.md`.

## Commands

```bash
npm run typecheck   # tsc --noEmit
npm run build       # lib/index.js (host) + lib/client.js (browser bundle)
npm test            # node --test across unit + contract + integration
node scripts/smoke.mjs 3081   # probe a running grad instance
```
