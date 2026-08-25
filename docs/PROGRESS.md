# Graduate OS — Progress / Resumable Checkpoint

> Living document. Update at the end of EVERY work session/phase.
> A fresh agent session should be able to resume from this file alone.

**Last updated:** 2026-08-25 · **Repo:** `C:\Users\Administrator\Projects\dsh-grad-workbench` · **Branch:** main

## How to resume after a disconnect

1. `git -C C:\Users\Administrator\Projects\dsh-grad-workbench log --oneline -5` and read this file.
2. Rebuild + test: `npm install` (first time only), then `npm run typecheck && npm test`.
3. Boot isolated dev instance: `node C:\Users\Administrator\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh\lib\bin.js --profile grad --port 3081 --no-open`
4. Smoke: `node scripts/smoke.mjs 3081`.
5. Headless agent check: same bin with `--profile grad-headless "<task mentioning grad_ping or other grad_* tools>"`.
6. Continue from "Next up" below.

## Environment facts (verified — see docs/COMPATIBILITY.md)

- DSH `@deepseek-ai/dsh@0.1.1-rc.2`, Node v24.15.0, Windows; checkout at
  `C:\Users\Administrator\AppData\Local\npm-cache\_npx\1e7f6d9597241db0`.
- Profiles: `~/.dsh/profiles/grad` (web UI, port 3081) and `~/.dsh/profiles/grad-headless`
  (one-shot agent runs). Both link this repo via node_modules junction.
- Zero runtime deps: host uses `node:sqlite` (FTS5 verified); tools are plain-object
  ToolDefinitions; client is an esbuild CJS bundle wrapped for `window.__ModuleLoader__`.
- Tests run via `node --test` against built `lib/` plus direct TS imports (type stripping).

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Recon + scaffold + grad profile + grad_ping + client shell | ✅ DONE |
| 1 | DB/artifacts/runs/approvals + capture + mock workflow + Home/Inbox UI | 🔜 NEXT |
| 2 | Memory v1 (FTS, scopes, supersession, candidate writes) + Memory Center | ⬜ |
| 3 | Research Radar: OpenAlex/S2 providers → dedup → cited synthesis → UI | ⬜ |
| 4 | Feishu CLI connector behind approval | ⬜ |
| 5 | Communication assistant | ⬜ |
| 6 | Food Map | ⬜ |
| 7 | Life Ledger + fitness | ⬜ |
| 8 | Form Assistant | ⬜ |
| 9 | Skill Studio | ⬜ |
| 10 | Audio brief | ⬜ |
| 11 | WeChat adapter (feature-flagged, disabled by default) | ⬜ |

## Next up (Phase 1 concrete steps)

1. `services/artifact-store.ts`: putArtifact/get/list/delete, SHA-256, layout `artifacts/<kind>/<runId>/`.
2. `services/run-store.ts` + `services/workflow-engine.ts`: queued→running→waiting_approval→completed/failed transitions in transactions; steps with tool calls.
3. `services/approval-service.ts`: pending/approved/rejected/expired/consumed; payload hash binding; consumed ≠ reusable.
4. `services/capture-service.ts` + deterministic router (`capture-router.ts`): text capture → route to registered workflow.
5. One mock workflow `echo-demo` proving end-to-end run + artifact + approval resolution.
6. Tools: `grad_capture`, `grad_route_capture`, `grad_run_workflow`, `grad_get_run`, `grad_list_runs`, `grad_approval_get`, `grad_approval_resolve`.
7. Routes under `/api/grad/*` for runs/captures/approvals; Home page shows recent runs + pending approvals.
8. Unit tests per service; integration test: full mock workflow run through engine; restart persistence test.

## Definition of done reminder

MVP = PRD §18. Do not declare success while any P0 slice is mocked that could run for real locally.
