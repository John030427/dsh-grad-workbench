# Graduate OS — Progress / Resumable Checkpoint

> Living document. Update at the end of EVERY work session/phase.
> A fresh agent session should be able to resume from this file alone.

**Last updated:** 2026-08-26 · **Repo:** `C:\Users\Administrator\Projects\dsh-grad-workbench` · **Branch:** main

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
| 2 | Memory v1 (FTS5, scopes, supersession, sensitivity, candidates) + Memory Center | ✅ DONE (30/30 tests, live + headless verified) |
| 3 | Research Radar: OpenAlex/S2 providers → dedup → cited synthesis → UI | 🔜 NEXT |
| 4 | Feishu CLI connector behind approval | ⬜ |
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
- Never declare `webServer` in static inject; use the guarded accessor.
- node --test runs .ts sources directly (type stripping) BUT parameter
  properties / enums / namespaces are unsupported — keep classes erasable.

## Next up (Phase 2 concrete steps)

1. `services/memory-service.ts`: CRUD on memory_items + FTS5 virtual table
   (`memory_fts`) kept in sync; rebuildable index.
2. Retrieval: lexical FTS + scope filter + recency decay + pinned boost; return
   {item, score, why, age} tuples; usage recording into memory_usage per run.
3. Candidate writes: proposeMemory() creates userConfirmed=0 items; confirm via
   tool/route; supersession via supersedesId (never destructive mutation).
4. Sensitivity gating: restricted items only leave storage when the caller
   explicitly requests that category AND policy allows; secrets never stored.
5. Tools: grad_memory_search / grad_memory_propose / grad_memory_confirm /
   grad_memory_update / grad_memory_delete (+ why-used explanation).
6. Memory Center page in client: search/filter/edit/delete/pin/outdated/export.
7. Tests: scope isolation, FTS match quality, supersession chain, sensitivity
   gating, usage provenance.

## Definition of done reminder

MVP = PRD §18. Do not declare success while any P0 slice is mocked that could run for real locally.
