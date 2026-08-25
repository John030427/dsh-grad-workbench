# Graduate OS / 硕博工作台 — MVP PRD

**Document status:** MVP v0.1  
**Target host:** DeepSeek Harness (DSH) Web plugin  
**Working repository:** `dsh-grad-workbench`  
**Product principle:** *Task-first, not model-first.*

---

## 1. Executive summary

Graduate students do not primarily need a “model switcher”. They need a system that understands **what kind of work is happening**, chooses a suitable workflow, reuses the right context, calls the right tools, and asks for approval before external side effects.

Graduate OS is a DSH workbench that unifies four spaces:

1. **Research** — literature, paper reading, synthesis, experiments, writing and defense.
2. **Communication** — advisor/teacher messages, progress updates, meeting preparation, reply drafting.
3. **Life** — food map, fitness log, volunteer/activity tracking and lightweight personal decisions.
4. **Automation** — form filling, reusable Skill recipes, connectors and repeated workflows.

Three shared foundations make those spaces coherent:

- **Memory** — local-first, scoped, inspectable and attributable.
- **Skill / Workflow Engine** — atomic skills compose into typed recipes instead of prompt concatenation.
- **Connector Layer** — Feishu/Lark first, WeChat as a controlled adapter, then other channels.

The MVP goal is not to implement every imagined function. It is to prove that the same foundation can support several high-frequency end-to-end graduate workflows without creating duplicated mini-products.

---

# 2. Problem

## 2.1 Current pain points

A graduate student repeatedly does work such as:

- “Summarize the newest papers in this field.”
- “Read these 50 papers and tell me the trend and research gaps.”
- “Publish the summary to Feishu.”
- “Turn the report into something I can listen to while walking.”
- “My advisor sent this message — what do they mean and how should I reply?”
- “Fill this scholarship / conference / reimbursement / school form.”
- “Record four volunteer hours and show my semester total.”
- “Log this workout and tell me what I did last time.”
- “I saw this restaurant in a screenshot; save it so I can find it on a map later.”
- “Combine these three actions into one reusable workflow.”

Today, each request usually starts from zero:
- context is lost across sessions;
- the user must know which model, tool, prompt or app to use;
- repeated workflows are not reusable;
- artifacts are scattered;
- external actions lack a consistent approval layer;
- “AI memory” is often opaque and difficult to correct.

## 2.2 Why “question → best model” is the wrong abstraction

A natural-language request usually contains several stages. Example:

> “Find the latest 50 papers on a topic, summarize the field, put it in Feishu and generate an audio brief.”

This is not one model task. It is a workflow:

```text
topic normalization
→ academic retrieval
→ metadata deduplication
→ relevance/ranking
→ paper evidence extraction
→ clustering / perspective discovery
→ synthesis with citations
→ artifact generation
→ Feishu publishing
→ audio script
→ TTS/audio artifact
```

Different steps need different capabilities. Therefore the product routes to a **Skill / Workflow**, and the workflow chooses model policy per node.

---

# 3. Product vision

## 3.1 One-line positioning

> **Graduate OS is a DSH-native “research + communication + life” workbench that turns recurring graduate-school tasks into reusable, memory-aware, cross-app workflows.**

## 3.2 Product promise

The user should be able to say or drop something simple:

- a sentence;
- a PDF;
- a screenshot;
- a link;
- a form URL;
- a restaurant card;
- a teacher/advisor chat screenshot;

and Graduate OS should turn it into a structured, inspectable action.

## 3.3 Non-goals for MVP

MVP will **not**:

- claim to always choose the globally best LLM;
- replace DSH’s native Agent / Session / Tool loop;
- fork or patch DSH core unless an upstream compatibility bug makes it unavoidable;
- autonomously send teacher/advisor messages;
- autonomously submit high-impact forms;
- scrape closed platforms through fragile or account-risky hooks;
- build a complete fitness/nutrition medical app;
- become a full Zotero replacement;
- become a full Notion/Feishu clone;
- build its own map tile infrastructure;
- build a cloud account/multi-user SaaS in v0.x.

---

# 4. Design principles

## P1 — Task-first routing

Route:

```text
input → intent/task family → skill/workflow → tools + memory + model policy
```

Do not route:

```text
input → “which model is best?”
```

## P2 — Local-first personal context

Graduate-school context can be highly personal. Default storage is local.

Memory must be:
- inspectable;
- editable;
- deletable;
- scoped;
- timestamped;
- source-attributed;
- confidence-aware.

## P3 — Human approval before external side effects

External writes must show a preview.

Examples requiring approval:
- send message;
- create/update Feishu docs when replacing existing content;
- submit a form;
- upload a file;
- publish;
- cancel or delete;
- overwrite important artifacts.

## P4 — Provenance over magical automation

Any important generated artifact should answer:
- what input produced it;
- which sources were used;
- which workflow and skill version ran;
- which model policy was used;
- what external actions happened;
- what the user changed afterwards.

## P5 — Skills are typed workflows, not prompt snippets

A Skill must state:
- inputs;
- outputs;
- tools;
- model policy;
- memory reads/writes;
- approval policy;
- artifacts;
- tests/evals.

Composite Skills are compiled as a DAG/recipe with validated inputs/outputs.

## P6 — Start with vertical slices

MVP success requires at least 4 complete paths, not 40 half-working menu items.

---

# 5. Information architecture

## 5.1 Global shell

Keep a **single DSH sidebar** and native Agent area. Do not introduce a second permanent navigation rail or duplicated chat UI.

Recommended top-level:

```text
Home
Inbox

Research
Communication
Life
Automation

Memory
Connections
Settings
```

Inside **Life**, use tabs/cards:
- Food Map
- Fitness
- Volunteer / Activity Ledger

Inside **Automation**:
- Form Assistant
- Skill Studio
- Workflow Recipes
- Run History

## 5.2 Home / Today

Home is a “graduate cockpit”, not a dashboard of vanity charts.

Show:
- universal capture box;
- today’s upcoming tasks/events if integrations exist;
- recent workflow runs;
- pending approvals;
- “continue previous work”;
- pinned research projects;
- quick actions:
  - Latest 50 papers
  - Understand/reply to teacher
  - Save restaurant
  - Fill form
  - Log volunteer hours
  - Log workout

---

# 6. Shared foundations

# 6.1 Universal Inbox

### Inputs
- text;
- image/screenshot;
- PDF/doc;
- URL;
- forwarded channel message;
- voice transcript (P1).

### Normalized object

```ts
type CaptureItem = {
  id: string;
  createdAt: string;
  source: "dsh" | "feishu" | "wechat" | "file" | "browser" | "share";
  sourceRef?: string;
  mimeType?: string;
  text?: string;
  attachmentRefs?: string[];
  inferredIntent?: string;
  routeConfidence?: number;
  status: "new" | "routed" | "archived";
};
```

### Routing behavior
1. deterministic rules for obvious inputs;
2. cheap classifier/embedding for common cases;
3. small LLM router only when ambiguous;
4. ask user when ambiguity changes side effects.

---

# 6.2 Memory Center

## Memory layers

### A. Session context
Use native DSH Session. Do not duplicate it.

### B. Project memory
Examples:
- research question;
- dataset decisions;
- paper collection decisions;
- advisor feedback tied to project;
- experiment decisions;
- accepted terminology;
- rejected approaches.

### C. Personal preference memory
Examples:
- preferred message tone;
- food preferences;
- preferred study/report style;
- common form fields;
- model/cost preference.

Sensitive categories must be opt-in and explicitly managed.

### D. Knowledge memory
Curated notes:
- methods;
- paper insights;
- reusable snippets;
- school procedures;
- lessons learned.

### E. Activity ledger
Append-only events:
- volunteer hours;
- workout sessions;
- reading sessions;
- research sessions;
- optional other user-defined activities.

## Memory object

```ts
type MemoryItem = {
  id: string;
  scopeType: "global" | "project" | "skill" | "channel";
  scopeId?: string;
  kind: "fact" | "preference" | "decision" | "lesson" | "entity" | "summary";
  content: string;
  sourceType: "user" | "workflow" | "artifact" | "import";
  sourceRef?: string;
  confidence: number;
  createdAt: string;
  validFrom?: string;
  validTo?: string;
  supersedesId?: string;
  sensitivity: "normal" | "private" | "restricted";
  userConfirmed: boolean;
};
```

## Retrieval
Hybrid:
- lexical/BM25;
- semantic embeddings;
- recency/temporal relevance;
- entity/project filters;
- explicit pinned memories.

## UX
Memory Center must support:
- search;
- filter by project/kind/source;
- “why was this memory used?”;
- edit;
- delete;
- pin;
- mark outdated;
- disable automatic memory writes;
- export.

## Write policy
Automatic memory extraction creates **candidate memory** first for high-impact personal facts.  
Project decisions from explicit workflow actions can be recorded automatically with provenance.

---

# 6.3 Skill / Workflow Engine

## Skill manifest

```yaml
id: literature-radar
version: 0.1.0
title: Latest Literature Radar

triggers:
  - latest papers
  - literature review
  - recent 50 papers

inputs:
  topic:
    type: string
    required: true
  count:
    type: integer
    default: 50
  since:
    type: string
    required: false

outputs:
  paper_collection:
    type: PaperCollection
  report_artifact:
    type: ArtifactRef

required_tools:
  - academic.search
  - academic.fetch_metadata
  - artifact.write_markdown

model_policy:
  router: economy
  synthesis: quality
  reviewer: balanced

memory:
  read:
    - project
    - research_preferences
  write:
    - project_decision
    - artifact_summary

approvals:
  external_publish: required

tests:
  - fixtures/literature-radar-basic.yml
```

## Workflow recipe

A recipe composes 2–N Skills:

```yaml
id: literature-to-feishu-audio
nodes:
  - id: radar
    skill: literature-radar
  - id: synth
    skill: literature-synthesis
  - id: publish
    skill: feishu-publish
  - id: audio
    skill: audio-brief
edges:
  - from: radar.paper_collection
    to: synth.collection
  - from: synth.report
    to: publish.document
  - from: synth.report
    to: audio.source
```

## Skill Studio MVP

User can:
- browse installed skills;
- inspect inputs/outputs/tools/model policy;
- create a recipe by selecting 2–5 skills;
- describe a repeated workflow in natural language;
- generate a **draft Skill manifest**;
- validate contract;
- test on fixtures;
- save only after review.

MVP must **not** allow arbitrary generated shell/API calls without permission review.

---

# 6.4 Model policy

## User modes
- **Economy** — cheap/fast by default; escalate on low confidence.
- **Balanced** — default.
- **Quality** — stronger reasoning + optional reviewer pass.
- **Manual** — user pins model(s).

## Skill-side capability declaration

```yaml
capabilities:
  reasoning: high
  coding: medium
  vision: required
  long_context: high
  structured_output: required
```

The router selects from configured DSH models that satisfy the capability constraints.

## Escalation
A workflow can escalate when:
- output fails schema validation;
- citations are missing;
- tool returns ambiguous results;
- reviewer confidence below threshold;
- user explicitly requests highest quality.

The router should never claim “globally best model”.

---

# 7. MVP vertical slices

# VS1 — Research Radar: latest 50 papers → synthesis → Feishu → audio

## User story

> “帮我找最近一年关于 AI agent memory 的最新 50 篇论文，按研究方向分类，总结趋势、代表论文、争议和研究空白，放到飞书，并给我一个 20 分钟能听完的版本。”

## Retrieval strategy

Primary metadata provider:
- **OpenAlex** for broad works search/filter/sort/paging.

Secondary/enrichment:
- **Semantic Scholar Academic Graph** for abstracts, citations, recommendations and metadata cross-checks.

Local/full-text:
- user-provided PDFs;
- open-access PDFs where legally accessible;
- PaperQA-style local indexing/evidence retrieval for actual full-text Q&A.

## Pipeline

```text
Topic Resolver
→ query expansion
→ OpenAlex search
→ Semantic Scholar enrichment
→ DOI/OpenAlex/S2 dedup
→ date/relevance/quality ranking
→ select N=50
→ metadata/evidence cache
→ cluster into perspectives/themes
→ per-cluster synthesis
→ cross-cluster synthesis
→ citation verifier
→ Markdown artifact
→ [approval] Feishu Doc/Markdown publish
→ audio script
→ TTS artifact
```

## Output

### Paper table
Fields:
- title;
- authors;
- year/date;
- venue;
- DOI;
- OpenAlex/S2 IDs;
- citation count;
- open-access status;
- abstract available;
- relevance score;
- theme/cluster;
- evidence status (`metadata-only`, `abstract`, `fulltext`).

### Report sections
1. scope/query;
2. selection method;
3. 50-paper table;
4. major themes;
5. chronological trend;
6. representative works;
7. methodological patterns;
8. disagreements/limitations;
9. research gaps;
10. “what to read first” shortlist;
11. source/citation appendix.

### Reliability rule
The report must clearly distinguish:
- metadata conclusion;
- abstract-supported conclusion;
- full-text-supported conclusion.

Do not make a precise methodological claim about a paper if only title/metadata is available.

## Feishu
Use official `larksuite/cli`:
- create/update Doc from Markdown;
- optionally write the paper list to Base/Sheets;
- optionally send the final link through Messenger;
- use dry-run / preview where supported.

## Audio
MVP produces:
- editable audio script;
- MP3/M4A via configured TTS provider;
- chapters + timestamps if supported.

Audio template:
- 1 min overview;
- 4–6 themed sections;
- 2–3 “must read” papers;
- research gaps;
- closing action list.

---

# VS2 — Teacher / Advisor Communication Assistant

## Inputs
- screenshot;
- pasted message;
- email;
- quoted conversation;
- project context.

## Internal classification

```text
relationship:
advisor / teacher / reviewer / admin / senior student / collaborator

scenario:
progress / correction / criticism / reminder / scheduling /
request / apology / leave / defense / rebuttal / follow-up

intent:
inform / confirm / explain / ask / negotiate / acknowledge / decline

risk:
low / medium / high
```

## Output
1. “我理解老师的核心诉求是……”
2. missing facts / risk points;
3. recommended reply;
4. optional tone variants;
5. commitments/deadlines extracted from the reply.

## Memory use
May read:
- project status;
- accepted terminology;
- prior user-approved communication style;
- prior teacher-related project decisions.

Must not invent progress or claim work is finished.

## Side effects
MVP drafts only. Sending requires explicit approval and connector capability.

---

# VS3 — Food Map

## User stories

> “把这个截图里的店记一下。”

> “这个小红书截图里的店在哪里？”

> “周末想吃烤肉，从我收藏里找三家。”

## Input pipeline

```text
Screenshot/text/link
→ vision/text extraction
→ restaurant/entity candidate
→ candidate place search/geocode
→ ambiguity check
→ user confirmation if needed
→ save Restaurant entity
→ map pin
```

## Restaurant entity

```ts
type Restaurant = {
  id: string;
  name: string;
  aliases: string[];
  address?: string;
  lat?: number;
  lng?: number;
  city?: string;
  sourceRefs: string[];
  sourceImages: string[];
  tags: string[];
  cuisines: string[];
  priceBand?: string;
  status: "want_to_try" | "visited" | "favorite" | "avoid";
  ratingByUser?: number;
  notes?: string;
  firstSavedAt: string;
  lastVisitedAt?: string;
};
```

## UX
- map view;
- list view;
- timeline;
- filters by cuisine/status/tag;
- unresolved places inbox;
- restaurant detail with source screenshot and notes.

## Critical rule
Never silently pin an ambiguous restaurant.  
If location resolution yields multiple plausible branches, show candidates and ask user to pick.

## Map
Use MapLibre GL JS (or compatible provider abstraction).  
Geocoding/place search is behind an adapter:

```ts
interface PlaceProvider {
  searchPlace(query, context): Promise<PlaceCandidate[]>;
  geocode(address): Promise<GeoPoint[]>;
  reverseGeocode(point): Promise<Address>;
}
```

This allows China-specific providers later without coupling UI/domain storage to one vendor.

---

# VS4 — Form Assistant

## User story
> “帮我把这个奖学金申请表填掉，基础信息用以前的，研究经历从我的项目资料里提取，但最后提交前让我确认。”

## Architecture

```text
form URL
→ browser inspect
→ identify fields
→ map to User Profile / Project Memory
→ generate proposed values
→ show diff/preview
→ user edits/approves
→ browser fills
→ final submit requires separate approval
```

## Repeated form optimization
First run:
- agentic browser.

After successful run:
- save a reusable “form recipe”:
  - URL/domain;
  - stable selectors/labels;
  - field mapping;
  - required sources;
  - validation rules.

Future runs:
- deterministic recipe first;
- fall back to agent only when DOM/labels changed.

## Personal profile vault
Store commonly reused fields only with explicit user confirmation.

Categories:
- identity basics;
- education;
- organization;
- research profile;
- contact;
- emergency/sensitive fields (never auto-fill by default).

---

# VS5 — Life Ledger: volunteer + fitness + research time

## Shared model

```ts
type LedgerEntry = {
  id: string;
  category: "volunteer" | "fitness" | "research" | "reading" | "custom";
  startAt: string;
  endAt?: string;
  durationMinutes?: number;
  projectId?: string;
  organization?: string;
  activityType?: string;
  note?: string;
  evidenceRefs?: string[];
  source: "manual" | "channel" | "import" | "tracker";
  verification: "self" | "evidence_attached" | "verified";
};
```

## Volunteer view
- semester/year total;
- organization totals;
- activity timeline;
- evidence attachment;
- export CSV/Markdown/Feishu Base;
- certificate/summary draft.

## Fitness view
MVP:
- routine;
- workout session;
- exercise sets/reps/weight/time;
- “last time” comparison;
- completion streak/history.

Do not turn MVP into health diagnosis or medical advice.

## Later integration
ActivityWatch-style event import can optionally bring:
- study/research time;
- app/browser time categories;
- coding time.

Must stay opt-in/local-first.

---

# 8. Additional research workflows (P1 after core MVP)

These are important to product identity but can reuse the same engine:

- Paper Reader with evidence/citations.
- Research Gap / STORM-style multi-perspective exploration.
- Research design / empirical design.
- Data analysis / reproducibility workbench integration.
- Academic writing.
- Reviewer / rebuttal.
- Defense simulator.
- Meeting preparation.
- “What should I do today?” using task/calendar/project memory.
- Reading queue and spaced review.
- Literature alerts / recurring research radar.

---

# 9. Connectors

## 9.1 DSH native
Primary interaction remains native DSH Agent/Session.

## 9.2 Feishu / Lark — P0
Use the official Lark/Feishu CLI instead of rebuilding its API surface.

MVP capabilities:
- create/update/search Docs;
- Messenger send/reply behind approval;
- Base/Sheets write for structured lists;
- Tasks/Calendar optional in P1;
- Minutes optional;
- file/media upload.

Connector must expose capability discovery.

## 9.3 WeChat — P1 beta
Requirements:
- adapter boundary;
- text/image/file/voice input where supported;
- normalize into `InboundEnvelope`;
- output preview + explicit sending approval;
- avoid brittle hook-based solutions as the foundation;
- feature flag and clear operational/security notice.

Preferred route:
- official/maintained channel bridge where available;
- CowAgent-style channel integration can be used as architectural reference/bridge, not as a reason to duplicate its whole agent runtime.

## 9.4 Normalized envelope

```ts
type InboundEnvelope = {
  id: string;
  channel: "dsh" | "feishu" | "wechat" | "other";
  accountId?: string;
  conversationId?: string;
  senderId?: string;
  timestamp: string;
  text?: string;
  attachments: AttachmentRef[];
  quotedMessage?: MessageRef;
};
```

---

# 10. Data model

MVP SQLite tables/entities:

- `workspaces`
- `projects`
- `capture_items`
- `source_refs`
- `artifacts`
- `workflow_definitions`
- `workflow_runs`
- `workflow_steps`
- `skill_registry`
- `skill_recipes`
- `memory_items`
- `memory_usage`
- `approval_requests`
- `connector_accounts`
- `connector_events`
- `paper_collections`
- `papers`
- `paper_collection_items`
- `restaurants`
- `restaurant_sources`
- `ledger_entries`
- `fitness_exercises`
- `fitness_sets`
- `form_profiles`
- `form_recipes`

All write-heavy domain entities should include:
- `created_at`;
- `updated_at`;
- optional `deleted_at`;
- provenance/source reference where relevant.

---

# 11. Artifact model

Filesystem:

```text
~/.dsh/grad-workbench/
├─ grad.db
├─ settings.json
├─ artifacts/
│  ├─ research/<project>/<run-id>/
│  ├─ audio/<run-id>/
│  ├─ forms/<run-id>/
│  └─ imports/
├─ cache/
│  ├─ academic/
│  └─ places/
├─ backups/
└─ logs/
```

Every generated artifact:
- has a stable ID;
- stores SHA-256;
- points to the workflow run;
- stores source refs;
- can be opened from UI.

---

# 12. Workflow execution and provenance

`WorkflowRun` stores:

```ts
type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowVersion: string;
  startedAt: string;
  finishedAt?: string;
  status: "queued" | "running" | "waiting_approval" | "failed" | "completed";
  inputSnapshot: unknown;
  outputRefs: string[];
  modelDecisions: ModelDecision[];
  sourceRefs: string[];
  approvalRefs: string[];
  sessionId?: string;
};
```

A step stores:
- Skill version;
- input;
- output;
- tool calls;
- timestamps;
- retry/fallback;
- model chosen;
- failure;
- user feedback.

---

# 13. Side-effect approval UX

Show a single consistent approval drawer/card.

Example:

```text
Action: Publish Feishu document
Destination: “AI Agent Memory — Latest 50 Papers”
Changes:
  + Create new doc
  + 8 sections
  + 50-row paper table
External write: YES

[Preview] [Approve once] [Cancel]
```

Forms require two stages:
1. approve fill;
2. approve submit.

Messages:
1. draft;
2. preview;
3. send approval.

---

# 14. Security / privacy requirements

- local SQLite by default;
- secrets never stored in normal memory;
- prefer OS keychain / existing CLI credential stores;
- redact secrets from logs;
- attachments are untrusted input;
- academic metadata and web text are untrusted input;
- HTML escape/sanitize before rendering;
- path traversal protection;
- file size/type limits;
- connector scopes are least-privilege;
- high-impact browser actions require approval;
- memory write rules are user-configurable;
- full memory export/delete available.

---

# 15. Metrics for MVP

## Product metrics
- % of routed captures requiring manual correction;
- workflow completion rate;
- approval cancellation rate;
- reused workflow recipe count;
- number of memory corrections;
- time from capture → useful artifact;
- literature report citation/evidence coverage;
- restaurant resolution ambiguity rate;
- form field auto-fill acceptance rate.

## Quality metrics

### Research Radar
- 50 unique papers unless corpus smaller;
- DOI/ID dedup accuracy;
- date filter correctness;
- ≥95% paper-table rows have at least one canonical source ID;
- synthesis claim citation coverage;
- no metadata-only paper described as if full text was read.

### Communication
- no invented user progress;
- no external send without approval;
- extracted commitments shown.

### Food
- no unconfirmed ambiguous location persisted as confirmed;
- saved pin retains source image/text.

### Form
- no final submit without second approval;
- all filled values trace to profile/memory/user input.

---

# 16. MVP scope / priority

## P0 — must ship

### Core
- DSH plugin Host + Client.
- dedicated `grad` development profile.
- Universal Inbox.
- task router.
- SQLite/artifact store.
- workflow engine.
- approval service.
- Memory Center v1.
- model policy v1.
- run history.

### Vertical slices
1. Latest-50 Research Radar → Markdown report.
2. Feishu publishing.
3. Teacher/advisor communication draft.
4. Food Map capture → confirm → pin.
5. Life Ledger (volunteer + basic fitness).
6. Form Assistant with preview/fill/submit approvals.
7. Skill Studio recipe composition (manual + AI draft).

## P1 — next

- audio brief;
- WeChat beta adapter;
- PaperQA-style full-text collections;
- scheduled literature radar;
- calendar/task connector;
- STORM-style perspective discovery;
- ActivityWatch import;
- richer fitness progression;
- share targets/mobile capture;
- skill marketplace/import.

## P2 — later

- multi-device sync;
- encrypted sync;
- team/lab workspace;
- broader IM ecosystem;
- automatic recurring research brief;
- richer food recommendations/routes;
- academic graph visualizations;
- full defense simulator;
- deeper experiment integration.

---

# 17. MVP demo script

A credible demo must show all three foundations being reused.

### Demo A — research
1. Ask: “最近一年 agent memory 最新 50 篇。”
2. Show query plan and collection.
3. Generate cited synthesis.
4. Publish preview to Feishu.
5. Approve.
6. See doc link and run provenance.

### Demo B — communication
1. Drop advisor screenshot.
2. System reads linked project memory.
3. Explains intent.
4. Drafts response.
5. User edits.
6. No message is sent automatically.

### Demo C — food
1. Drop restaurant screenshot.
2. Vision extracts name.
3. Place resolver returns two candidates.
4. User chooses.
5. Restaurant appears on Food Map with screenshot source.

### Demo D — life ledger
1. “今天志愿服务 3 小时，在 XX 活动。”
2. Ledger records it.
3. Fitness entry shares same event infrastructure.
4. Semester summary exports to Feishu/CSV.

### Demo E — automation
1. Open a repeatable form.
2. First run uses browser agent.
3. Preview proposed values.
4. Fill after approval.
5. Save reusable form recipe.
6. Run again deterministically.

---

# 18. Acceptance definition for “MVP complete”

MVP is complete only if:

- the plugin installs into an isolated DSH profile without forking core;
- native DSH agent/session remains usable;
- all P0 screens are reachable through one coherent shell;
- at least the five demo flows above run end-to-end;
- memory used by a workflow can be inspected and corrected;
- every external write is gated by approval;
- workflow run history can explain what happened;
- unit + integration + UI smoke tests pass;
- Windows is tested because the intended development environment includes Windows;
- README and setup docs can reproduce the demo from a clean clone.
