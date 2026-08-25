# DSH Graduate OS — Detailed Development Plan

**Purpose:** execution plan for a coding agent working for long sessions.  
**Rule:** build a DSH plugin, not a second agent harness.

---

# 0. Goal

Implement `dsh-grad-workbench`, a standalone Host + Client DSH plugin for **Graduate OS / 硕博工作台**.

The plugin must:
- preserve DSH’s native Agent / Session / Tool pipeline;
- add a coherent workbench UI;
- provide Memory, Skill/Workflow and Connector foundations;
- implement P0 vertical slices defined in `docs/MVP_PRD.md`;
- install into an isolated `grad` profile for development/testing;
- remain compatible with the normal `web` profile unless the user explicitly installs it there.

---

# 1. Non-negotiable architecture constraints

1. **Do not fork DSH core.**
2. **Do not build a duplicate chat backend.**
3. **Do not create a second permanent sidebar.**
4. **Do not replace native DSH Session storage with custom conversation storage.**
5. **Do not silently perform external writes.**
6. **Do not make hidden long-term memory.**
7. **Do not fabricate research results or claim to have read full text when only metadata/abstract is available.**
8. **Do not couple domain objects to a single model/provider/map provider/channel.**
9. **Do not optimize by adding features before one vertical slice works end-to-end.**
10. **Do not publish/release/push externally without the user’s instruction.**

---

# 2. Upstream recon before implementation

At the start of development, inspect the installed/current DSH version and current plugin contracts. DSH is in active development and community examples may target different RC versions.

Read:
- current DSH host docs;
- `dsh-io/dsh-plugin-skill`;
- current plugin template/official scaffold output;
- relevant installed DSH package typings;
- working `dsh-personal-workbench` and `dsh-science-workbench` patterns.

Record the actual compatibility target in:

```text
docs/COMPATIBILITY.md
```

Include:
- DSH version;
- Node version;
- package manager;
- plugin APIs;
- web extension points;
- profile install command;
- known DOM/UI contracts if any;
- Windows behavior.

Do not blindly copy rc.6 selectors/contracts if the current host has changed.

---

# 3. Repository structure

Target:

```text
dsh-grad-workbench/
├─ src/
│  ├─ index.ts
│  ├─ config.ts
│  ├─ host/
│  │  ├─ runtime.ts
│  │  ├─ services/
│  │  │  ├─ db.ts
│  │  │  ├─ artifact-store.ts
│  │  │  ├─ approval-service.ts
│  │  │  ├─ memory-service.ts
│  │  │  ├─ workflow-engine.ts
│  │  │  ├─ skill-registry.ts
│  │  │  ├─ model-policy.ts
│  │  │  ├─ connector-registry.ts
│  │  │  └─ capture-router.ts
│  │  ├─ domains/
│  │  │  ├─ research/
│  │  │  ├─ communication/
│  │  │  ├─ food/
│  │  │  ├─ ledger/
│  │  │  └─ forms/
│  │  ├─ tools/
│  │  └─ routes/
│  ├─ client/
│  │  ├─ index.ts
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ pages/
│  │  └─ state/
│  └─ shared/
│     ├─ contracts.ts
│     ├─ schemas.ts
│     └─ errors.ts
├─ skills/
│  ├─ literature-radar/
│  ├─ literature-synthesis/
│  ├─ feishu-publish/
│  ├─ audio-brief/
│  ├─ teacher-communication/
│  ├─ save-restaurant/
│  ├─ form-assistant/
│  ├─ ledger-log/
│  └─ skill-maker/
├─ fixtures/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ contracts/
│  └─ e2e/
├─ scripts/
├─ docs/
├─ dsh.plugin.json            # only if current host requires it
├─ cordis.patch.yml
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
└─ README.md
```

Use the actual current DSH scaffold conventions discovered during recon.

---

# 4. Development profile

Use a dedicated profile:

```text
grad
```

Purpose:
- isolate plugin composition;
- protect normal `web`;
- prevent experiments from changing existing modeling workbench setup.

Typical development flow (adapt to current CLI):

```bash
dsh plugin --profile grad add link:/absolute/path/to/dsh-grad-workbench
dsh --profile grad ...
```

Before modifying profile config:
- snapshot it;
- never reset unrelated user settings.

---

# 5. Host/Client responsibilities

## Host is source of truth
Host owns:
- DB;
- artifact files;
- memory;
- workflow execution;
- skills;
- connector calls;
- approvals;
- research retrieval;
- map entity resolution metadata;
- form automation orchestration.

## Client is projection
Client:
- renders state;
- sends typed commands;
- never bypasses Host approval;
- does not store canonical domain state in localStorage except harmless UI preferences.

## DSH native Agent
Use DSH tools/skills so the native agent can drive Graduate OS.

Example tools:

```text
grad_capture
grad_route_capture
grad_run_workflow
grad_get_run
grad_list_runs

grad_memory_search
grad_memory_propose
grad_memory_update
grad_memory_delete

grad_research_latest
grad_research_get_collection
grad_research_synthesize

grad_food_resolve
grad_food_save
grad_food_list

grad_ledger_add
grad_ledger_summary

grad_form_inspect
grad_form_prepare
grad_form_fill
grad_form_submit

grad_approval_get
grad_approval_resolve
```

Every `defineTool` must follow the current authoritative DSH schema/output contract.

---

# 6. Shared typed contracts first

Before domain implementation, define shared contracts with runtime validation.

Recommended:
- JSON Schema or Zod at domain boundaries;
- serializable contracts only;
- stable enum values;
- migrations for DB schema.

Required types:
- `CaptureItem`
- `InboundEnvelope`
- `SourceRef`
- `ArtifactRef`
- `MemoryItem`
- `SkillManifest`
- `WorkflowRecipe`
- `WorkflowRun`
- `WorkflowStep`
- `ApprovalRequest`
- `ModelPolicy`
- `ModelDecision`
- `Paper`
- `PaperCollection`
- `Restaurant`
- `LedgerEntry`
- `FormRecipe`

Contract tests must reject invalid payloads.

---

# 7. SQLite and migrations

Use SQLite for structured local state.

Requirements:
- WAL mode where appropriate;
- migration table;
- transactions for workflow state transitions;
- foreign keys enabled;
- soft delete for user-owned records where recovery is useful;
- indexes for memory, run history, papers, restaurants, ledger.

Migration naming:

```text
001_init.sql
002_memory.sql
003_research.sql
...
```

No “auto recreate database on schema mismatch” in normal operation.

Backup:
- small daily/local backup or pre-migration backup;
- documented restore path.

---

# 8. Artifact store

Implement early because all domains depend on it.

API:

```ts
putArtifact({
  kind,
  mediaType,
  sourcePathOrBytes,
  workflowRunId,
  sourceRefs
}) -> ArtifactRef

getArtifact(id)
listArtifacts(filter)
deleteArtifact(id)
```

Persist:
- SHA-256;
- path;
- media type;
- createdAt;
- producing run;
- source refs;
- size.

Never trust filename from uploaded content for filesystem path.

---

# 9. Approval service

Implement before connectors/forms.

States:

```text
pending
approved
rejected
expired
consumed
```

Approval object:
- action type;
- human-readable summary;
- structured payload;
- destination;
- preview artifact;
- created time;
- expiration;
- originating run/step.

A consumed approval cannot be reused for a different payload.

Tests:
- payload mutation after approval must invalidate approval;
- duplicate submit must not repeat side effect unless explicitly idempotent.

---

# 10. Memory service

## 10.1 Storage strategy
Start local and simple:
- canonical records in SQLite;
- FTS5 for lexical search;
- pluggable embedding backend;
- no mandatory external vector DB.

## 10.2 Retrieval
Score:
```text
semantic
+ lexical
+ scope
+ recency
+ pinned
+ entity/project match
```

Return not only content but:
- why matched;
- source;
- age;
- scope.

## 10.3 Candidate writes
For personal facts/preferences:
- extract candidate;
- show candidate in Memory Center or lightweight confirmation;
- write only according to configured policy.

Explicit user command “remember …” can write directly with source=user.

Project workflow decisions:
- may auto-write if generated from explicit approved action;
- still show provenance.

## 10.4 Supersession, not destructive mutation
If a fact changes:
- new item references `supersedesId`;
- old item remains traceable until user deletes it.

## 10.5 Sensitive controls
- `normal/private/restricted`;
- restricted memory never sent to a model unless current workflow explicitly requests that category and user policy permits.
- secrets are never memory.

---

# 11. Skill Registry and recipe compiler

## 11.1 Skill discovery
Load:
- bundled skills;
- project-local skills;
- user-installed skills through a controlled registry.

Skill metadata should follow familiar `SKILL.md` conventions but extend with a machine-readable manifest for Graduate OS.

Recommended:

```text
skills/<id>/
├─ SKILL.md
├─ skill.yaml
├─ examples/
└─ fixtures/
```

`SKILL.md` teaches the agent.  
`skill.yaml` is machine-enforced contract.

## 11.2 Recipe validation
Before save/run:
- detect cycles;
- validate node IDs;
- validate type compatibility;
- validate required tools/connectors;
- validate side-effect approvals;
- validate memory scopes;
- validate model capability requirements.

## 11.3 AI skill maker
Natural language → **draft only**:
1. infer inputs/outputs;
2. identify existing atomic skills;
3. prefer composition over generating new code;
4. if new Skill required, create proposal;
5. run validation;
6. generate fixture;
7. user reviews;
8. save.

Never let “skill maker” silently create arbitrary executable code and immediately run it.

---

# 12. Model policy service

## 12.1 Query configured DSH models
Do not hard-code model names into business logic.

Build capability registry from:
- adapter/provider metadata where available;
- local config;
- optional user overrides.

## 12.2 Policy

```ts
type ModelPolicyMode = "economy" | "balanced" | "quality" | "manual";
```

Skill asks for capabilities, not brand.

## 12.3 Structured validation loop
For schema-producing steps:
1. call selected model;
2. validate;
3. repair with same model once;
4. escalate model if policy allows;
5. fail with inspectable error.

## 12.4 Reviewer
Quality workflows may use:
- generator;
- independent reviewer;
- targeted revision.

Do not run reviewers for trivial low-risk actions.

## 12.5 Cost/latency
Record:
- model ID;
- provider;
- tokens/cost when DSH exposes them;
- latency;
- escalation reason.

---

# 13. Phase plan

# Phase 0 — Recon + scaffold

Deliverables:
- current DSH compatibility notes;
- plugin scaffold;
- build/test scripts;
- isolated `grad` profile install;
- one `grad_ping` tool;
- one minimal client page/tab.

Acceptance:
- clean install;
- host loads/unloads;
- client loads;
- native agent still works;
- `grad_ping` called by native agent;
- normal `web` profile unchanged.

Commit:
```text
chore: scaffold grad workbench plugin
```

---

# Phase 1 — Foundation vertical slice

Build:
- DB + migrations;
- ArtifactStore;
- RunStore;
- ApprovalService;
- basic Home/Inbox;
- `grad_capture`;
- `grad_run_workflow` with one mock workflow.

Acceptance:
- capture text;
- route to test workflow;
- create artifact;
- see run history;
- create approval and resolve it;
- restart DSH and state persists.

Commit:
```text
feat: add workflow foundation and approvals
```

---

# Phase 2 — Memory v1

Build:
- memory table/service;
- FTS;
- optional embedding interface;
- Memory Center;
- candidate memory;
- scope filtering;
- `grad_memory_*` tools.

Acceptance:
- “remember X” creates inspectable memory;
- project-scoped query only retrieves that project unless global allowed;
- edit/delete/supersede works;
- workflow run records which memory IDs were used;
- no memory is injected without source metadata.

Commit:
```text
feat: add scoped local memory
```

---

# Phase 3 — Research Radar

## 3A metadata providers

Provider interface:

```ts
interface AcademicProvider {
  search(query: AcademicQuery): Promise<AcademicSearchPage>;
  getPaper(id: CanonicalPaperId): Promise<Paper>;
}
```

Implement:
- OpenAlex;
- Semantic Scholar enrichment.

Cache responses.

## 3B dedup
Canonical keys:
1. normalized DOI;
2. OpenAlex ID;
3. S2 ID;
4. fallback title+year+first-author fingerprint.

Keep provider records in `source_refs`.

## 3C selection
User asks N papers.
- query expansion;
- date range;
- relevance;
- configurable sort;
- take a candidate pool >N;
- dedup;
- produce N unique where available.

Do not let “latest” accidentally become “most cited only”.

## 3D synthesis
Pipeline:
- collection profile;
- per-paper evidence card;
- theme clustering;
- multi-perspective outline;
- draft;
- citation/evidence checker;
- final Markdown.

Every claim should link to supporting paper IDs in structured form before rendering.

## 3E UI
Research page:
- search spec;
- run progress;
- 50-paper data grid;
- filters;
- evidence status;
- report;
- export/publish actions.

Acceptance:
- fixture query returns exact count where data available;
- duplicate DOI eliminated;
- provenance retained;
- report differentiates metadata/abstract/fulltext;
- retry/rate limit handling;
- cached repeat run avoids unnecessary calls.

Commit series:
```text
feat: add academic provider layer
feat: add literature collection and dedup
feat: add cited literature synthesis
feat: add research radar UI
```

---

# Phase 4 — Feishu connector

Use official `larksuite/cli` as the first implementation.

## Adapter

```ts
interface Connector {
  id: string;
  capabilities(): ConnectorCapabilities;
  health(): Promise<Health>;
  preview(action): Promise<Preview>;
  execute(action, approval): Promise<ConnectorResult>;
}
```

Implement `FeishuCliConnector`.

Never parse human CLI output if structured JSON is available.

Capabilities:
- doc create/update;
- markdown;
- Base/Sheets rows;
- IM send;
- optional file upload.

Auth:
- rely on official CLI auth/keychain where possible;
- do not copy tokens into Graduate OS DB.

Acceptance:
- health check;
- create-doc preview;
- approval required;
- execute once;
- external result URL/ID stored on workflow run;
- dry-run path tested.

Commit:
```text
feat: add feishu cli connector
```

---

# Phase 5 — Communication assistant

Build Skill:
- screenshot/text input;
- vision extraction via configured model/tool;
- context assembler;
- scenario/intent/risk classification;
- reply drafting;
- commitments extraction.

UI:
- source preview;
- “what the teacher/advisor is asking”;
- context used;
- recommended reply;
- tone variants;
- commitments.

No direct send at first. Feishu send can be offered only through approval.

Acceptance:
- no invented project facts;
- user can see linked memory;
- image + text fixture tests;
- screenshot source stored as artifact.

Commit:
```text
feat: add advisor communication workflow
```

---

# Phase 6 — Food Map

## 6A domain + resolver
Implement:
- restaurant entity;
- source screenshots;
- candidate resolver;
- ambiguity state.

## 6B map
Use MapLibre GL JS (or current compatible wrapper).

UI:
- map;
- clustered pins if needed;
- list;
- filter;
- unresolved queue;
- detail drawer.

## 6C place adapter
Define provider-neutral interface.
Initially support one provider chosen by current environment/config.
Keep raw provider ID under `source_refs`, not as canonical restaurant ID.

Acceptance:
- screenshot fixture → candidate;
- ambiguous fixture → no confirmed pin before user selection;
- saved pin survives restart;
- detail keeps original screenshot/source;
- map works with ≥100 entries without unusable rendering.

Commit:
```text
feat: add food capture and map
```

---

# Phase 7 — Life Ledger + fitness

## Ledger
Implement generic timestamped events.

Volunteer UI:
- add/edit/delete;
- monthly/semester totals;
- org/project group;
- evidence;
- export.

Fitness extension:
- workout session;
- exercise;
- set;
- “last workout” lookup.

Keep health/medical inference out.

Acceptance:
- duration calculations correct across timezone/day boundary;
- summary totals fixture tested;
- evidence refs survive export;
- workout sets link to one ledger session.

Commit:
```text
feat: add life ledger and fitness log
```

---

# Phase 8 — Form Assistant

Start with Browser Use integration/skill if the environment supports it. Keep automation behind interface so the implementation can change.

## Engine

```ts
interface BrowserAutomation {
  inspect(url): Promise<FormSchema>;
  fill(plan): Promise<FillResult>;
  submit(plan): Promise<SubmitResult>;
}
```

## Flow
1. inspect form;
2. map fields;
3. resolve values;
4. show source of each value;
5. approval A: fill;
6. fill;
7. validate page;
8. approval B: submit;
9. submit;
10. save form recipe after successful run.

## Recipe
Store:
- domain;
- URL pattern;
- field labels/selectors;
- value source;
- validation;
- last success;
- DOM fingerprint.

On mismatch:
- do not blindly click;
- fall back to inspect/agent.

Acceptance:
- fixture/local test form;
- first run fills;
- second run uses deterministic recipe;
- changed DOM triggers fallback;
- submit impossible without separate approval.

Commit:
```text
feat: add approved form assistant
```

---

# Phase 9 — Skill Studio

Build:
- skill browser;
- manifest viewer;
- recipe canvas/list builder;
- type checks;
- AI draft;
- fixtures;
- run recipe;
- versioning.

MVP UI can use ordered cards rather than a complex node graph.

Acceptance:
- combine `literature-radar → literature-synthesis → feishu-publish`;
- compile detects missing input;
- side-effect skill automatically adds approval node/gate;
- recipe version retained in runs.

Commit:
```text
feat: add skill studio and recipe compiler
```

---

# Phase 10 — Audio brief

Implement provider-neutral TTS.

Pipeline:
- report → listening script → review → TTS;
- store transcript + audio artifact;
- Feishu upload/share optional.

Acceptance:
- transcript editable;
- audio file generated;
- workflow run links report, script and audio;
- no need to regenerate research if user only edits audio script.

Commit:
```text
feat: add research audio brief
```

---

# Phase 11 — WeChat beta adapter

Do not use an archived/brittle hook project as core dependency.

Create adapter with normalized envelope.

Possible integration:
- maintained/official WeChat channel bridge;
- CowAgent bridge if operationally appropriate;
- otherwise keep adapter disabled and document setup.

Requirements:
- feature flag;
- capability discovery;
- inbound text/image/file/voice normalization;
- outbound approval;
- channel-specific user/conversation IDs kept outside semantic memory.

Acceptance:
- channel disabled by default;
- no effect on startup if unavailable;
- mocked adapter tests;
- real smoke test only when credentials/channel are explicitly supplied.

Commit:
```text
feat: add wechat connector adapter
```

---

# 14. UI rules

- one sidebar;
- no duplicated model/session/chat controls;
- native DSH agent remains visually recognizable;
- Workbench central content is primary;
- detail is drawer/modal/tab, not permanent third column everywhere;
- run status is visible;
- every AI-generated important artifact shows provenance;
- every external action has preview;
- error messages tell user what failed and what can be retried.

Avoid “dashboard of 30 cards”.

---

# 15. Research reliability implementation

For every paper claim, internal evidence representation:

```ts
type EvidenceLink = {
  paperId: string;
  evidenceLevel: "metadata" | "abstract" | "fulltext";
  locator?: string;
  quoteHash?: string;
  claimId: string;
};
```

Synthesis step must:
- produce structured claims;
- validate paper IDs exist;
- flag unsupported claims;
- render citations only after validation.

If a paper’s full text was not fetched, do not say “the paper finds X through method Y” unless the abstract explicitly supports it.

---

# 16. Testing strategy

## Unit
- schemas;
- router rules;
- memory scoring;
- dedup;
- ledger durations;
- approval state machine;
- recipe compiler;
- model policy selection;
- form mapping.

## Integration
- SQLite migrations;
- artifact store;
- OpenAlex/S2 mocked providers;
- Feishu CLI mocked process;
- place provider;
- browser adapter.

## Contract tests
- DSH tool schema;
- client/host payloads;
- connector capabilities;
- Skill manifests.

## E2E smoke
- fresh `grad` profile;
- plugin loads;
- native Agent calls tool;
- UI opens;
- create capture;
- research fixture run;
- food fixture;
- ledger;
- memory;
- approvals.

## Golden fixtures
Keep deterministic fixture datasets for:
- 60 paper results with duplicates;
- advisor screenshot OCR/vision transcript;
- restaurant screenshot with ambiguous branches;
- sample form;
- volunteer/fitness entries.

## Real network tests
Tag separately and skip by default.

---

# 17. Observability

Local structured logs:
- run ID;
- step ID;
- skill ID/version;
- tool;
- duration;
- status;
- error class;
- model decision;
- connector action.

Redact:
- auth tokens;
- passwords;
- API keys;
- sensitive form values.

UI Run Inspector:
- timeline;
- input/output;
- retries;
- sources;
- model choices;
- memory used;
- approvals;
- artifacts.

---

# 18. Failure handling

## Academic provider rate limit
- backoff;
- cache;
- resume;
- partial collection shown;
- never silently replace with hallucinated papers.

## Model failure
- schema repair;
- retry;
- policy escalation;
- expose failure.

## Connector unavailable
- retain artifact locally;
- mark publish step retryable.

## Ambiguous place
- move to unresolved queue.

## Browser DOM change
- invalidate recipe;
- inspect again;
- do not auto-submit.

## Corrupt memory index
- canonical SQLite rows remain source of truth;
- rebuild search index.

---

# 19. Security checklist

- [ ] loopback-only local routes unless DSH explicitly provides authenticated route layer
- [ ] path normalization
- [ ] MIME/size validation
- [ ] SQL parameterization
- [ ] HTML sanitization/escaping
- [ ] command argument escaping
- [ ] no shell interpolation of user-controlled text
- [ ] secrets omitted from logs/db
- [ ] connector least privilege
- [ ] approval payload hash
- [ ] CSRF/origin considerations for web routes
- [ ] dependency audit
- [ ] third-party license attribution
- [ ] untrusted academic/web text treated as data, not instructions

---

# 20. Third-party strategy

Prefer “learn patterns / call public API / use CLI” over vendoring large projects.

### Safe to directly depend/reference when compatible
- DSH official/community plugin dev contracts;
- Lark official CLI;
- MapLibre;
- Browser Use;
- provider SDKs.

### Use as design reference unless license/integration reviewed
- Dawarich (AGPL);
- wger (AGPL);
- other large applications.

### Academic data
Use official APIs and lawful open-access sources.

Record all copied/adapted code in `THIRD_PARTY_NOTICES.md`.

---

# 21. Milestone gates

A phase is not done because code compiles.

For every phase:

```text
Research
→ Inspect current repo/host
→ Implement smallest vertical slice
→ Unit/contract test
→ Integration test
→ Run in real isolated DSH profile
→ UX review
→ Architecture review
→ Fix
→ Regression
→ Commit
```

Do not batch ten phases into one giant commit.

---

# 22. Stop conditions for an autonomous coding agent

Continue independently through normal engineering choices.

Stop only when blocked by:
- missing credential required for a real external smoke test;
- paid API/service decision;
- irreversible external publish/send/submit;
- destructive data deletion;
- production deployment;
- a product decision that changes privacy/security promises.

When blocked:
- finish everything that can be done with mocks/fixtures;
- document exact blocker;
- provide one next command/action.

---

# 23. First implementation target

The first real end-to-end slice after foundations should be:

> **“latest 50 papers → dedup collection → cited Markdown synthesis → local artifact → approval preview → mocked/real Feishu publication.”**

Reason:
- proves academic provider layer;
- proves workflow engine;
- proves artifacts;
- proves memory/project context;
- proves model policy;
- proves external approval;
- proves connector;
- creates a visible outcome users immediately understand.

Only after this is solid should implementation fan out to Food Map, forms and other Life modules.

---

# 24. Definition of done

Before calling the project MVP:

```bash
# adapt commands to actual package scripts
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Then verify:
- fresh install in `grad`;
- restart persistence;
- Windows smoke test;
- normal web profile unaffected;
- README setup reproducible;
- no uncommitted generated artifacts;
- third-party notices complete;
- every P0 external side effect gated by approval;
- no demo uses fabricated data.
