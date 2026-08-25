# Research references and design extraction

This document records what Graduate OS should learn from high-signal projects. Star counts are approximate snapshots from research on 2026-08-26 and will change.

| Project | Approx stars | What to borrow | What not to copy blindly |
|---|---:|---|---|
| `anthropics/skills` | 171k | self-contained `SKILL.md`, clear trigger descriptions, examples, progressive skill packaging | do not assume one vendor/runtime; add machine-enforced contracts |
| `browser-use/browser-use` | 110k | browser-as-agent tool, forms, structured automation, auth/session patterns | do not make one-off browser agent the only method for repeated forms |
| `mem0ai/mem0` | 64k | dedicated memory layer, relevant-memory retrieval, user/session filtering | do not make opaque automatic memory; Graduate OS needs inspect/edit/delete/provenance |
| `zhayujie/CowAgent` | 46k | multi-channel adapters, Skills vs Tools, conversational skill creator, long-term memory/KB | do not duplicate another whole agent harness inside DSH |
| `stanford-oval/storm` | 30k | multi-perspective question asking, pre-writing research, source-grounded synthesis | do not use it as a generic “summarize 50 papers” black box |
| `assafelovic/gpt-researcher` | 29k | planner/execution split, parallel research, source tracking, final publisher | web research and academic literature need different retrieval/evidence rules |
| `ActivityWatch/activitywatch` | 18k | local-first lifedata, timestamped events, buckets, query/REST design | do not record everything by default; opt-in and minimum necessary data |
| `larksuite/cli` | 16k | official Feishu/Lark agent-native CLI, 200+ commands, 20+ Skills, structured actions | do not rebuild Feishu API surface |
| `maplibre/maplibre-gl-js` | 11k | interactive vector map layer | map rendering != place/entity resolution; keep providers separate |
| `Freika/dawarich` | 10k | map + timeline + visits + confirmation + photo/location provenance | AGPL: prefer architectural inspiration unless license strategy allows dependency |
| `Future-House/paper-qa` | 9k | high-accuracy scientific RAG, citations, metadata enrichment, indexed paper collections | large collections need rate-limit/API-key planning; distinguish metadata/abstract/full text |
| `wger-project/wger` | 6.8k | workout routines, progression, exercise schema, REST-first integrations | AGPL; do not clone into an MIT plugin |
| `lamm-mit/PDF2Audio` | 1.4k | document → editable transcript → podcast/lecture/summary → TTS | keep TTS provider-neutral; avoid locking research pipeline to audio implementation |
| `Dely0/dsh-personal-workbench` | 4 | DSH-native task sessions, local SQLite, task-shared context, approval-style completion | DSH DOM contracts may change; do not inherit a whole task manager unless needed |
| `poplarity/dsh-science-workbench` | 7 | artifact provenance, manifest ledger, rerun lineage, hashes, environment snapshot | its permanent multi-panel layout should not dictate all Graduate OS screens |
| `dsh-io/dsh-plugin-skill` / plugin templates | small/new | current `defineTool` and Cordis/plugin contracts, scaffold/test/profile workflow | DSH is moving quickly: inspect current host before coding |

---

## 1. Academic retrieval stack

### OpenAlex
Role:
- broad academic corpus;
- works endpoint;
- search/filter/sort/paging;
- DOI/author/source/topic graph;
- cheap first-stage retrieval.

Graduate OS decision:
- OpenAlex is the primary “latest N” discovery layer.

### Semantic Scholar Academic Graph
Role:
- publication metadata;
- abstracts/PDF URLs where available;
- citations;
- recommendations;
- bulk search and sorting.

Graduate OS decision:
- enrichment/cross-check provider;
- use batch/bulk endpoints and cache.

### PaperQA
Borrow:
- local paper collection index;
- chunked evidence;
- evidence ranking;
- citations;
- metadata enrichment.

Graduate OS decision:
- full-text evidence is a separate stage/status from metadata discovery.

### STORM
Borrow:
- dynamic perspective discovery;
- question decomposition;
- multi-perspective outline before long synthesis.

Graduate OS decision:
- use STORM-style perspective discovery for “field synthesis/research gap” after the deterministic paper collection is frozen.

### GPT Researcher
Borrow:
- planner vs execution agents;
- parallel branches;
- source tracking;
- publisher stage;
- observability.

Graduate OS decision:
- workflow engine can parallelize paper/theme evidence tasks without making the entire plugin a multi-agent framework.

---

## 2. Skill system

### Anthropic Agent Skills
Borrow:
- folder-per-skill;
- `SKILL.md`;
- clear trigger description;
- examples/guidelines.

### CowAgent
Borrow:
- atomic Tools vs higher-level Skills;
- marketplace/source installation;
- conversational skill creator.

### Graduate OS extension
A prompt-only Skill is not enough for safe composition.

Add `skill.yaml`:
- typed inputs/outputs;
- required tools;
- memory scopes;
- model capability policy;
- side-effect approvals;
- fixtures/tests.

Composite workflows use a typed DAG and validator.

---

## 3. Memory

### Mem0
Borrow:
- memory as independent layer;
- query-based relevant recall;
- filtering by user/session/project concepts.

### CowAgent
Borrow:
- short/mid/long-term separation;
- knowledge base separate from chronological memory.

### DSH personal workbench
Borrow:
- context belongs to domain entities/tasks, not only a global chat.

### Graduate OS decision
Five layers:
1. native DSH session;
2. project memory;
3. personal preference memory;
4. knowledge memory;
5. append-only activity ledger.

Every memory item has:
- scope;
- source;
- timestamp;
- confidence;
- sensitivity;
- user-confirmed flag;
- supersession.

---

## 4. Forms

### Browser Use
Borrow:
- natural-language browser control;
- click/type/fill;
- custom tools;
- existing browser profile/session.

Graduate OS decision:
- first run can be agentic;
- successful repeated form becomes a deterministic recipe;
- AI returns only when page/schema changes;
- fill and submit have separate approval gates.

This pattern reduces:
- token cost;
- accidental clicks;
- latency;
- nondeterminism.

---

## 5. Life Ledger

### ActivityWatch
Borrow:
- event/bucket mental model;
- local ownership;
- extensibility;
- queryable timeline.

Graduate OS decision:
Use one generic `LedgerEntry` for:
- volunteer hours;
- workouts;
- research/reading time;
- future user-defined categories.

Domain-specific UIs are projections over a shared event substrate.

---

## 6. Fitness

### wger
Borrow:
- routine;
- workout session;
- exercise;
- sets/reps/weight;
- progression;
- API-first schema.

Graduate OS MVP:
- no nutrition/medical system;
- no diagnosis;
- just useful training records and “last time” context.

---

## 7. Food Map

### MapLibre GL JS
Borrow:
- modern interactive map;
- scalable browser rendering.

### Dawarich
Borrow:
- map + timeline;
- visit/place confirmation;
- photo/source linkage;
- imports/exports.

Graduate OS decision:
- screenshots/text become source artifacts;
- AI extracts a restaurant candidate;
- place provider resolves it;
- ambiguous candidate requires user confirmation;
- saved restaurant retains its source.

Map engine and place provider are separate interfaces.

---

## 8. Feishu

### Lark/Feishu official CLI
Borrow/use directly:
- Docs;
- Markdown;
- Base;
- Sheets;
- Messenger;
- Tasks;
- Calendar;
- Meetings/Minutes;
- skill maker;
- structured agent-friendly commands.

Graduate OS decision:
- CLI is the P0 Feishu adapter;
- reuse its auth instead of copying credentials;
- all external writes go through Graduate OS ApprovalService.

---

## 9. WeChat and multi-channel

### CowAgent
Borrow:
- a normalized channel abstraction;
- text/image/file/voice capability matrix;
- one web console controlling channels/skills/memory.

Graduate OS decision:
- DSH remains the harness;
- implement `Connector` / `InboundEnvelope`;
- WeChat is a channel adapter, not the product core;
- prefer maintained/official integration pathways;
- archived hook-based projects are not a long-term foundation.

---

## 10. DSH-specific lessons

### dsh-personal-workbench
Useful:
- local SQLite;
- native DSH session association;
- domain/task shared context;
- AI proposal → user acceptance pattern;
- single plugin providing Host+Client.

### dsh-science-workbench
Useful:
- every artifact traceable;
- single project ledger/manifest;
- lineage;
- hashes;
- feedback → rerun;
- local git;
- cross-platform shell awareness.

### Graduate OS adaptation
Instead of one science manifest per project, use:
- SQLite canonical run/event records;
- filesystem artifacts;
- hashes;
- optional per-project human-readable index.

Use the same “traceable and replayable” philosophy for:
- research reports;
- Feishu publication;
- forms;
- restaurant captures;
- audio briefs.

---

## 11. Licensing note

Do not treat GitHub stars as permission to copy code.

Before adding any code/dependency:
- inspect license;
- record attribution;
- prefer APIs/interfaces/patterns when a project is AGPL or otherwise restrictive;
- keep `THIRD_PARTY_NOTICES.md`.

Projects such as Dawarich and wger are especially useful as product/schema references but should not be copied into a permissively licensed plugin without a deliberate licensing decision.
