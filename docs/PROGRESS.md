# Graduate OS — Progress / Resumable Checkpoint

> Living document. Update at the end of EVERY work session/phase.
> A fresh agent session should be able to resume from this file alone.

**Last updated:** 2026-08-26 · **Repo:** `C:\Users\Administrator\Projects\dsh-grad-workbench` · **Branch:** main

## Verified live end-to-end (real DSH instance, port 3081)

- grad profile boots clean; smoke.mjs passes; client bundle served
- research radar against REAL OpenAlex: 15 unique papers collected, deduped,
  synthesized into evidence-tagged Markdown artifact (11 validated claims);
  S2 rate-limit degraded gracefully into provider notes
- headless agent flows: capture→route, workflow start→parking→inspection,
  memory remember/search, research latest→synthesize (no auto-approval)

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
| 1 | DB/artifacts/runs/approvals + capture + mock workflow + Home/Inbox UI | ✅ DONE |
| 2 | Memory v1 (FTS5, scopes, supersession, sensitivity, candidates) + Memory Center | ✅ DONE |
| 3 | Research Radar: providers → dedup → cited synthesis → UI (golden slice LIVE) | ✅ DONE (39/39 tests) |
| 4 | Feishu CLI connector behind approval | 🔜 NEXT |
| 5 | Communication assistant | ⬜ |
| 6 | Food Map | ⬜ |
| 7 | Life Ledger + fitness | ⬜ |
| 8 | Form Assistant | ⬜ |
| 9 | Skill Studio | ⬜ |
| 10 | Audio brief | ⬜ |
| 11 | WeChat adapter (feature-flagged, disabled by default) | ⬜ |

## Headless smoke profile

`~/.dsh/profiles/grad-headless`: bundles = dsh-base, @deepseek-ai/dsh-headless,
**dsh-webserver-shim** (`~/.dsh/dsh-webserver-shim`, provides no-op webServer via
ctx.provide), dsh-grad-workbench. Lets the full plugin load for one-shot agent
smoke tests without an HTTP layer.

## Next up (Phase 3 concrete steps)

1. `src/host/providers/openalex.ts`: works endpoint client (search/filter/sort,
   per-page cursor), mailto polite pool, timeout+retry+backoff, response cache
   dir `cache/academic/openalex/`.
2. `src/host/providers/semanticscholar.ts`: enrichment by DOI/title (abstract,
   citationCount, tldr); rate-limit aware (429 → backoff, never hard fail).
3. Dedup: canonical keys DOI > OpenAlex ID > S2 ID > title+year+first-author
   fingerprint; keep provider records as sourceRefs.
4. Collection builder: query expansion (user topic + synonyms pass), date
   filter (since), candidate pool >N (e.g. fetch 3×N), rank, cut N unique;
   evidenceLevel metadata-only until abstract obtained.
5. Synthesis skill: structured claims w/ paperId links → citation validation →
   Markdown report artifact (sections per PRD VS1); evidence-level discipline.
6. Tools: grad_research_latest / grad_research_get_collection /
   grad_research_synthesize (+ collection storage tables migration 003).
7. Research page: search spec form, progress, paper grid, report view, export.
8. Tests: mocked providers (fixtures), dedup accuracy on 60-row fixture with
   dupes, cache reuse (no second network call), partial-state honesty.

## Hard-won contract facts (do not relearn)

- Tool `parameters` must be RAW JSON Schema — compile spec maps via
  `compileParameters()` in `src/host/tools/define.ts` (spec form silently
  produces permissive wire schemas and the model sends no args).
- Tool outputs are enforced LOSSLESS JSON: strip `undefined` via
  `toJsonLossless()` (already wired into `defineGradTool`).
- Prefix webserver routes must be registered WITHOUT trailing slash; suffix
  slicing still uses the slash form (`pathnameSuffix(req, prefix + '/')`).
- webServer IS declared in static inject; headless profiles satisfy it via the
  `dsh-webserver-shim` bundle (ctx.provide no-op) — see profile notes above.
- node --test runs .ts sources directly (type stripping) BUT parameter
  properties / enums / namespaces are unsupported — keep classes erasable.

## Next up (Phase 4 — Feishu connector)

1. Check whether `larksuite/cli` (`lark` binary) exists locally; implement
   `FeishuCliConnector` behind the Connector interface with a MOCK executor for
   tests; document the real-credential blocker when hit.
2. `src/host/connectors/feishu.ts`: Connector {id, capabilities(), health(),
   preview(action), execute(action, approvalId)}; execute() REQUIRES an
   approved approval id and consumes it via ApprovalService before any CLI call.
3. Action types: doc.create-from-markdown, doc.update-append, base.row-insert,
   im.send. Previews rendered as Markdown cards.
4. Recipe `literature-to-feishu`: build-collection → synthesize → publish
   (approval-gated step).
5. Tools: grad_connector_list / grad_feishu_preview / grad_feishu_publish.
6. Connections page UI: capability cards + health + auth state.
7. Tests: mocked CLI process; approval enforcement; payload-hash binding;
   consumed-approval cannot republish.

Then Phases 5-9 per docs/DSH_DEVELOPMENT_PLAN.md (communication → food →
ledger → forms → skill studio), each: service + tools + routes + UI page +
tests + live verify + commit. Phase 10 audio brief needs a TTS provider choice
(likely user-input point). Phase 11 WeChat stays feature-flagged OFF.

## Known deferred items

- LLM narrative synthesis (currently deterministic metadata-level reports) —
  needs model-policy service integration (plan §12).
- OpenAlex now enforces a daily budget from this machine's IP — real-network
  tests stay tagged/separate; disk cache is consulted first.

## Definition of done reminder

MVP = PRD §18. Do not declare success while any P0 slice is mocked that could run for real locally.
