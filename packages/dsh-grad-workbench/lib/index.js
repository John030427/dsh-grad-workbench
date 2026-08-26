// src/host/index.ts
import { readFileSync as readFileSync3 } from "node:fs";
import { fileURLToPath } from "node:url";

// src/host/env.ts
import { homedir } from "node:os";
import { join } from "node:path";
function resolveDataDir() {
  const override = process.env.GRAD_WORKBENCH_HOME;
  if (override && override.trim().length > 0) return override;
  return join(homedir(), ".dsh", "grad-workbench");
}
function dataLayout(root) {
  return {
    root,
    dbPath: join(root, "grad.db"),
    artifactsDir: join(root, "artifacts"),
    cacheDir: join(root, "cache"),
    logsDir: join(root, "logs"),
    backupsDir: join(root, "backups")
  };
}

// src/host/services/db.ts
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
var MIGRATIONS = [
  {
    version: 1,
    name: "core-foundation",
    sql: `
CREATE TABLE IF NOT EXISTS capture_items (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  mime_type TEXT,
  text TEXT,
  attachment_refs TEXT,
  inferred_intent TEXT,
  route_confidence REAL,
  status TEXT NOT NULL DEFAULT 'new',
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_capture_status ON capture_items(status, created_at);

CREATE TABLE IF NOT EXISTS source_refs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_source_refs (
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(id),
  PRIMARY KEY (artifact_id, source_ref_id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  media_type TEXT NOT NULL,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  workflow_run_id TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(workflow_run_id);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  input_snapshot TEXT,
  output_refs TEXT NOT NULL DEFAULT '[]',
  model_decisions TEXT NOT NULL DEFAULT '[]',
  source_refs TEXT NOT NULL DEFAULT '[]',
  approval_refs TEXT NOT NULL DEFAULT '[]',
  session_id TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_status ON workflow_runs(status, started_at);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  input TEXT,
  output TEXT,
  tool_calls TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  finished_at TEXT,
  model_chosen TEXT,
  failure TEXT,
  retry_of TEXT
);
CREATE INDEX IF NOT EXISTS idx_steps_run ON workflow_steps(run_id, started_at);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  destination TEXT,
  preview_artifact_id TEXT,
  workflow_run_id TEXT,
  step_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  resolved_at TEXT,
  consumed_at TEXT,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests(status, created_at);

CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  confidence REAL NOT NULL DEFAULT 0.8,
  created_at TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  supersedes_id TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  outdated INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory_items(scope_type, scope_id, kind);
CREATE INDEX IF NOT EXISTS idx_memory_supersedes ON memory_items(supersedes_id);

CREATE TABLE IF NOT EXISTS memory_usage (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memory_items(id),
  workflow_run_id TEXT NOT NULL,
  step_id TEXT,
  used_at TEXT NOT NULL,
  why TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_usage_run ON memory_usage(workflow_run_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
`
  },
  {
    version: 2,
    name: "memory-fts",
    sql: `
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(memory_id UNINDEXED, content);
`
  },
  {
    version: 3,
    name: "research-collections",
    sql: `
CREATE TABLE IF NOT EXISTS paper_collections (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  query_spec TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  complete INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES paper_collections(id),
  title TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '[]',
  year INTEGER,
  date TEXT,
  venue TEXT,
  doi TEXT,
  openalex_id TEXT,
  s2_id TEXT,
  citation_count INTEGER,
  open_access INTEGER,
  abstract_available INTEGER NOT NULL DEFAULT 0,
  abstract_text TEXT,
  relevance_score REAL,
  theme TEXT,
  evidence_level TEXT NOT NULL DEFAULT 'metadata',
  fingerprint TEXT NOT NULL,
  selected INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_papers_collection ON papers(collection_id, year);
CREATE INDEX IF NOT EXISTS idx_papers_fingerprint ON papers(fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_coll_doi ON papers(collection_id, doi) WHERE doi IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_coll_openalex ON papers(collection_id, openalex_id) WHERE openalex_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_coll_s2 ON papers(collection_id, s2_id) WHERE s2_id IS NOT NULL;
`
  },
  {
    version: 4,
    name: "connector-events",
    sql: `
CREATE TABLE IF NOT EXISTS connector_events (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  approval_id TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  ok INTEGER,
  external_ref TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_connector_events_time ON connector_events(created_at);
`
  },
  {
    version: 5,
    name: "restaurants",
    sql: `
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  address TEXT,
  lat REAL,
  lng REAL,
  city TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]',
  source_texts TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  cuisines TEXT NOT NULL DEFAULT '[]',
  price_band TEXT,
  status TEXT NOT NULL DEFAULT 'unresolved',
  rating_by_user INTEGER,
  notes TEXT,
  first_saved_at TEXT NOT NULL,
  last_visited_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status, first_saved_at);
`
  },
  {
    version: 6,
    name: "life-ledger",
    sql: `
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  duration_minutes INTEGER,
  organization TEXT,
  activity_type TEXT,
  note TEXT,
  evidence_refs TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  verification TEXT NOT NULL DEFAULT 'self',
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ledger_category ON ledger_entries(category, start_at);

CREATE TABLE IF NOT EXISTS fitness_sets (
  id TEXT PRIMARY KEY,
  ledger_entry_id TEXT NOT NULL REFERENCES ledger_entries(id),
  exercise TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  weight_kg REAL,
  duration_minutes INTEGER,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_fitness_sets_entry ON fitness_sets(ledger_entry_id);
`
  },
  {
    version: 7,
    name: "forms",
    sql: `
CREATE TABLE IF NOT EXISTS form_profile_fields (
  id TEXT PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS form_recipes (
  id TEXT PRIMARY KEY,
  url_pattern TEXT NOT NULL UNIQUE,
  title TEXT,
  dom_fingerprint TEXT NOT NULL,
  field_map TEXT NOT NULL DEFAULT '{}',
  last_success_at TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
`
  }
];
function openDatabase(opts) {
  const { layout } = opts;
  if (opts.allowNew !== false) {
    mkdirSync(layout.root, { recursive: true });
  }
  const db = new DatabaseSync(layout.dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const appliedRows = db.prepare("SELECT version FROM _migrations ORDER BY version").all();
  const appliedVersions = new Set(appliedRows.map((r) => r.version));
  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    const run = () => {
      db.exec("BEGIN IMMEDIATE");
      return {
        commit: () => db.exec("COMMIT"),
        rollback: () => db.exec("ROLLBACK")
      };
    };
    const tx = run();
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        migration.version,
        migration.name,
        (/* @__PURE__ */ new Date()).toISOString()
      );
      tx.commit();
    } catch (err) {
      tx.rollback();
      throw new Error(
        `migration ${migration.version} (${migration.name}) failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return {
    db,
    appliedMigrations() {
      return db.prepare("SELECT version, name FROM _migrations ORDER BY version").all();
    }
  };
}

// src/host/services/artifact-store.ts
import { createHash } from "node:crypto";
import { mkdirSync as mkdirSync2, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join as join2 } from "node:path";

// src/shared/errors.ts
var GradError = class extends Error {
  code;
  retryable;
  /** Optional structured detail for UI/tool rendering. */
  detail;
  constructor(code, message, opts) {
    super(message);
    this.name = "GradError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.detail = opts?.detail;
  }
};
function isGradError(e) {
  return e instanceof GradError;
}
var errors = {
  notFound: (what, id) => new GradError("NOT_FOUND", `${what} not found: ${id}`, { detail: { what, id } }),
  invalidInput: (message, detail) => new GradError("INVALID_INPUT", message, { detail }),
  approvalRequired: (action) => new GradError("APPROVAL_REQUIRED", `Action "${action}" requires explicit user approval before it can run`, { detail: { action } }),
  approvalInvalid: (id, reason) => new GradError("APPROVAL_INVALID", `Approval ${id} cannot be used: ${reason}`, { detail: { id, reason } }),
  providerFailure: (provider, message, retryable = true) => new GradError("PROVIDER_FAILURE", `Academic/provider "${provider}" call failed: ${message}`, { retryable, detail: { provider } }),
  rateLimited: (provider, retryAfterMs) => new GradError("RATE_LIMITED", `Provider "${provider}" rate limit hit; retry later`, {
    retryable: true,
    detail: { provider, retryAfterMs }
  }),
  workflowState: (runId, from, to) => new GradError("WORKFLOW_STATE", `Workflow run ${runId} cannot move from "${from}" to "${to}"`, { detail: { runId, from, to } })
};

// src/host/services/artifact-store.ts
var KIND_DIRS = {
  "research-report": "research",
  "paper-table": "research",
  "audio-script": "audio",
  "audio-file": "audio",
  "communication-draft": "communication",
  "form-recipe": "forms",
  "export-csv": "exports",
  "import": "imports",
  "generic": "misc"
};
var EXTENSIONS = {
  "text/markdown": ".md",
  "text/plain": ".txt",
  "application/json": ".json",
  "text/csv": ".csv",
  "audio/mpeg": ".mp3",
  "image/png": ".png"
};
var ArtifactStore = class {
  db;
  artifactsRoot;
  constructor(db, artifactsRoot) {
    this.db = db;
    this.artifactsRoot = artifactsRoot;
  }
  put(input) {
    const id = crypto.randomUUID();
    const dir = join2(this.artifactsRoot, KIND_DIRS[input.kind] ?? "misc");
    mkdirSync2(dir, { recursive: true });
    const ext = EXTENSIONS[input.mediaType] ?? ".bin";
    const path = join2(dir, `${id}${ext}`);
    const bytes = typeof input.bytes === "string" ? Buffer.from(input.bytes, "utf8") : Buffer.from(input.bytes);
    writeFileSync(path, bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const createdAt = input.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `INSERT INTO artifacts (id, kind, media_type, path, sha256, size_bytes, created_at, workflow_run_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.kind, input.mediaType, path, sha256, bytes.length, createdAt, input.workflowRunId ?? null);
    for (const ref of input.sourceRefs ?? []) {
      this.db.prepare("INSERT OR IGNORE INTO source_refs (id, kind, ref, title, created_at) VALUES (?, ?, ?, ?, ?)").run(ref.id, ref.kind, ref.ref, ref.title ?? null, ref.createdAt);
      this.db.prepare("INSERT OR IGNORE INTO artifact_source_refs (artifact_id, source_ref_id) VALUES (?, ?)").run(id, ref.id);
    }
    return {
      id,
      kind: input.kind,
      mediaType: input.mediaType,
      path,
      sha256,
      sizeBytes: bytes.length,
      createdAt,
      workflowRunId: input.workflowRunId,
      sourceRefs: input.sourceRefs ?? []
    };
  }
  getMeta(id) {
    const row = this.db.prepare(
      `SELECT id, kind, media_type, path, sha256, size_bytes, created_at, workflow_run_id, deleted_at
         FROM artifacts WHERE id = ?`
    ).get(id);
    if (!row || row.deleted_at) throw errors.notFound("artifact", id);
    return {
      id: row.id,
      kind: row.kind,
      mediaType: row.media_type,
      path: row.path,
      sha256: row.sha256,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      workflowRunId: row.workflow_run_id ?? void 0,
      sourceRefs: []
    };
  }
  readText(id) {
    const meta = this.getMeta(id);
    if (!meta.mediaType.startsWith("text/") && meta.mediaType !== "application/json") {
      throw errors.invalidInput(`artifact ${id} is not textual (${meta.mediaType})`);
    }
    return { meta, text: readFileSync(meta.path, "utf8") };
  }
  list(filter = {}) {
    const clauses = ["deleted_at IS NULL"];
    const params = [];
    if (filter.kind) {
      clauses.push("kind = ?");
      params.push(filter.kind);
    }
    if (filter.workflowRunId) {
      clauses.push("workflow_run_id = ?");
      params.push(filter.workflowRunId);
    }
    params.push(filter.limit ?? 50);
    const rows = this.db.prepare(`SELECT id FROM artifacts WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).all(...params);
    return rows.map((r) => this.getMeta(r.id));
  }
  delete(id) {
    const meta = this.getMeta(id);
    try {
      rmSync(meta.path, { force: true });
    } catch {
    }
    this.db.prepare("UPDATE artifacts SET deleted_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
  }
};

// src/host/services/approval-service.ts
import { createHash as createHash2 } from "node:crypto";
function payloadHash(payload) {
  return createHash2("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}
var ApprovalService = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    const id = crypto.randomUUID();
    const now = /* @__PURE__ */ new Date();
    const expiresAt = input.ttlMs ? new Date(now.getTime() + input.ttlMs).toISOString() : null;
    this.db.prepare(
      `INSERT INTO approval_requests
           (id, action_type, summary, payload, payload_hash, destination, preview_artifact_id,
            workflow_run_id, step_id, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      id,
      input.actionType,
      input.summary,
      JSON.stringify(input.payload ?? null),
      payloadHash(input.payload),
      input.destination ?? null,
      input.previewArtifactId ?? null,
      input.workflowRunId ?? null,
      input.stepId ?? null,
      now.toISOString(),
      expiresAt
    );
    return this.get(id);
  }
  rowToApproval(row) {
    return {
      id: row.id,
      actionType: row.action_type,
      summary: row.summary,
      payload: JSON.parse(row.payload ?? "null"),
      payloadHash: row.payload_hash,
      destination: row.destination ?? void 0,
      previewArtifactId: row.preview_artifact_id ?? void 0,
      workflowRunId: row.workflow_run_id ?? void 0,
      stepId: row.step_id ?? void 0,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? void 0,
      resolvedAt: row.resolved_at ?? void 0,
      consumedAt: row.consumed_at ?? void 0,
      resolvedBy: row.resolved_by ?? void 0
    };
  }
  fetchRow(id) {
    const row = this.db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id);
    if (!row) throw errors.notFound("approval request", id);
    if (row.status === "pending" && typeof row.expires_at === "string" && Date.parse(row.expires_at) < Date.now()) {
      this.db.prepare("UPDATE approval_requests SET status = 'expired' WHERE id = ? AND status = 'pending'").run(id);
      row.status = "expired";
    }
    return row;
  }
  get(id) {
    return this.rowToApproval(this.fetchRow(id));
  }
  list(filter = {}) {
    const clauses = [];
    const params = [];
    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    if (filter.workflowRunId) {
      clauses.push("workflow_run_id = ?");
      params.push(filter.workflowRunId);
    }
    params.push(filter.limit ?? 50);
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db.prepare(`SELECT * FROM approval_requests ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
    return rows.map((r) => this.rowToApproval(r));
  }
  /** pending → approved | rejected */
  resolve(id, decision, by = "user") {
    const current = this.get(id);
    if (current.status !== "pending") {
      throw errors.approvalInvalid(id, `status is "${current.status}", only "pending" can be resolved`);
    }
    this.db.prepare(
      `UPDATE approval_requests SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ? AND status = 'pending'`
    ).run(decision, (/* @__PURE__ */ new Date()).toISOString(), by, id);
    return this.get(id);
  }
  /**
   * approved → consumed. The caller must present the exact payload the approval
   * was created for; a mutated payload invalidates the approval without consuming it.
   * Returns the stored approval on success so the caller can proceed exactly once.
   */
  consume(id, presentedPayload) {
    const current = this.get(id);
    if (current.status === "expired") throw errors.approvalInvalid(id, "approval expired");
    if (current.status !== "approved") {
      throw errors.approvalInvalid(id, `status is "${current.status}", only "approved" can be consumed`);
    }
    if (payloadHash(presentedPayload) !== current.payloadHash) {
      throw errors.approvalInvalid(id, "payload changed after approval \u2014 approval invalidated, create a new one");
    }
    this.db.prepare(`UPDATE approval_requests SET status = 'consumed', consumed_at = ? WHERE id = ? AND status = 'approved'`).run((/* @__PURE__ */ new Date()).toISOString(), id);
    return this.get(id);
  }
};

// src/host/services/workflow-engine.ts
var WorkflowEngine = class {
  definitions = /* @__PURE__ */ new Map();
  active = /* @__PURE__ */ new Set();
  db;
  approvals;
  artifacts;
  constructor(db, approvals, artifacts) {
    this.db = db;
    this.approvals = approvals;
    this.artifacts = artifacts;
  }
  register(def) {
    this.definitions.set(def.id, def);
    return () => this.definitions.delete(def.id);
  }
  listWorkflows() {
    return [...this.definitions.values()].map((d) => ({
      id: d.id,
      version: d.version,
      title: d.title,
      steps: d.steps.length
    }));
  }
  getDefinition(id) {
    const def = this.definitions.get(id);
    if (!def) throw errors.notFound("workflow", id);
    return def;
  }
  // ── run lifecycle ─────────────────────────────────────────────────────────
  start(workflowId, rawInput, sessionId) {
    const def = this.getDefinition(workflowId);
    const input = def.validateInput(rawInput);
    const runId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const tx = this.begin();
    try {
      this.db.prepare(
        `INSERT INTO workflow_runs
             (id, workflow_id, workflow_version, started_at, status, input_snapshot, output_refs, model_decisions, source_refs, approval_refs, session_id)
           VALUES (?, ?, ?, ?, 'queued', ?, '[]', '[]', '[]', '[]', ?)`
      ).run(runId, def.id, def.version, now, JSON.stringify(input ?? null), sessionId ?? null);
      let prevOutput = JSON.stringify(input ?? null);
      for (const step of def.steps) {
        const stepId = crypto.randomUUID();
        this.db.prepare(
          `INSERT INTO workflow_steps (id, run_id, skill_id, skill_version, name, status, input, tool_calls)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, '[]')`
        ).run(stepId, runId, step.skillId ?? step.name, def.version, step.name, prevOutput);
        prevOutput = null;
      }
      tx.commit();
    } catch (err) {
      tx.rollback();
      throw err;
    }
    return this.drive(runId).then(() => this.getRun(runId));
  }
  /**
   * Continue a parked run. Safe to call repeatedly (idempotent while waiting).
   * Returns the run snapshot AFTER an attempt to advance it.
   */
  async resume(runId) {
    await this.drive(runId);
    return this.getRun(runId);
  }
  async drive(runId) {
    if (this.active.has(runId)) return;
    this.active.add(runId);
    try {
      await this.loop(runId);
    } finally {
      this.active.delete(runId);
    }
  }
  async loop(runId) {
    const def = this.definitionForRun(runId);
    const steps = this.stepRows(runId);
    const rejected = this.approvals.list({ workflowRunId: runId, limit: 100 }).find((a) => a.status === "rejected");
    if (rejected) {
      this.skipRemaining(runId);
      this.setStatus(runId, "failed", `approval rejected: ${rejected.summary}`);
      return;
    }
    const stillPending = this.approvals.list({ workflowRunId: runId, status: "pending", limit: 1 });
    if (stillPending.length > 0) {
      this.setStatus(runId, "waiting_approval");
      return;
    }
    this.setStatus(runId, "running");
    let previousOutput;
    for (let i = 0; i < steps.length; i++) {
      const stepRow = steps[i];
      if (stepRow.status === "completed" || stepRow.status === "skipped") {
        previousOutput = stepRow.output ? JSON.parse(stepRow.output) : void 0;
        continue;
      }
      if (stepRow.status === "failed") return;
      const stepDef = def.steps[i];
      if (stepDef.requiresApprovals) {
        const existing = this.approvals.list({ workflowRunId: runId, limit: 100 });
        const mine = existing.filter((a) => a.stepId === stepRow.id);
        if (mine.length === 0) {
          const stepInput2 = stepRow.input ? JSON.parse(stepRow.input) : previousOutput;
          for (const spec of stepDef.requiresApprovals(stepInput2)) {
            this.approvals.create({ ...spec, workflowRunId: runId, stepId: stepRow.id });
          }
          this.setStatus(runId, "waiting_approval");
          return;
        }
      }
      const approvedForStep = this.approvals.list({ workflowRunId: runId, limit: 100 }).filter(
        (a) => a.stepId === stepRow.id && a.status === "approved"
      );
      for (const approval of approvedForStep) {
        this.approvals.consume(approval.id, approval.payload);
      }
      const stepInput = stepRow.input ? JSON.parse(stepRow.input) : previousOutput;
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.db.prepare("UPDATE workflow_steps SET status = 'running', started_at = ? WHERE id = ?").run(startedAt, stepRow.id);
      const toolCalls = [];
      const createdArtifacts = [];
      const stepArtifacts = {
        put: (input) => {
          const ref = this.artifacts.put({ ...input, workflowRunId: input.workflowRunId ?? runId });
          createdArtifacts.push(ref.id);
          return ref;
        },
        getMeta: (id) => this.artifacts.getMeta(id),
        readText: (id) => this.artifacts.readText(id),
        list: (filter) => this.artifacts.list(filter),
        delete: (id) => this.artifacts.delete(id)
      };
      try {
        const output = await stepDef.execute(stepInput, {
          runId,
          stepId: stepRow.id,
          artifacts: stepArtifacts,
          recordToolCall: (tool, ok) => toolCalls.push({ tool, at: (/* @__PURE__ */ new Date()).toISOString(), ok })
        });
        for (const artifactId of createdArtifacts) {
          this.attachArtifact(runId, artifactId);
        }
        const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
        this.db.prepare("UPDATE workflow_steps SET status = 'completed', output = ?, finished_at = ?, tool_calls = ? WHERE id = ?").run(JSON.stringify(output ?? null), finishedAt, JSON.stringify(toolCalls), stepRow.id);
        previousOutput = output;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.db.prepare("UPDATE workflow_steps SET status = 'failed', failure = ?, finished_at = ?, tool_calls = ? WHERE id = ?").run(message, (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(toolCalls), stepRow.id);
        this.skipRemainingAfter(runId, stepRow.id);
        this.setStatus(runId, "failed", message);
        return;
      }
    }
    this.setStatus(runId, "completed");
  }
  // ── queries ───────────────────────────────────────────────────────────────
  getRun(id) {
    const row = this.db.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(id);
    if (!row) throw errors.notFound("workflow run", id);
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowVersion: row.workflow_version,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? void 0,
      status: row.status,
      inputSnapshot: JSON.parse(row.input_snapshot ?? "null"),
      outputRefs: JSON.parse(row.output_refs ?? "[]"),
      modelDecisions: JSON.parse(row.model_decisions ?? "[]"),
      sourceRefs: JSON.parse(row.source_refs ?? "[]"),
      approvalRefs: row.approval_refs ? JSON.parse(row.approval_refs) : [],
      sessionId: row.session_id ?? void 0,
      error: row.error ?? void 0
    };
  }
  listRuns(filter = {}) {
    const clauses = [];
    const params = [];
    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    params.push(filter.limit ?? 25);
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db.prepare(`SELECT id FROM workflow_runs ${where} ORDER BY started_at DESC LIMIT ?`).all(...params);
    return rows.map((r) => this.getRun(r.id));
  }
  getSteps(runId) {
    const rows = this.db.prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY rowid").all(runId);
    return rows.map((r) => ({
      id: r.id,
      runId: r.run_id,
      skillId: r.skill_id ?? void 0,
      skillVersion: r.skill_version ?? void 0,
      name: r.name,
      status: r.status,
      input: safeParse(r.input),
      output: safeParse(r.output),
      toolCalls: safeParse(r.tool_calls ?? "[]"),
      startedAt: r.started_at ?? void 0,
      finishedAt: r.finished_at ?? void 0,
      failure: r.failure ?? void 0
    }));
  }
  recordSourceRefs(runId, refs) {
    this.db.prepare("UPDATE workflow_runs SET source_refs = ? WHERE id = ?").run(JSON.stringify(refs), runId);
  }
  recordModelDecision(runId, decision) {
    const run = this.getRun(runId);
    const decisions = [...run.modelDecisions, decision];
    this.db.prepare("UPDATE workflow_runs SET model_decisions = ? WHERE id = ?").run(JSON.stringify(decisions), runId);
  }
  attachArtifact(runId, artifactId) {
    const run = this.getRun(runId);
    const refs = [.../* @__PURE__ */ new Set([...run.outputRefs, artifactId])];
    this.db.prepare("UPDATE workflow_runs SET output_refs = ? WHERE id = ?").run(JSON.stringify(refs), runId);
  }
  attachApproval(runId, approvalId) {
    const run = this.getRun(runId);
    const refs = [.../* @__PURE__ */ new Set([...run.approvalRefs, approvalId])];
    this.db.prepare("UPDATE workflow_runs SET approval_refs = ? WHERE id = ?").run(JSON.stringify(refs), runId);
  }
  // ── internals ─────────────────────────────────────────────────────────────
  definitionForRun(runId) {
    const run = this.getRun(runId);
    return this.getDefinition(run.workflowId);
  }
  stepRows(runId) {
    return this.db.prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY rowid").all(runId);
  }
  setStatus(runId, status, error) {
    if (status === "completed" || status === "failed") {
      this.db.prepare("UPDATE workflow_runs SET status = ?, finished_at = ?, error = COALESCE(?, error) WHERE id = ?").run(status, (/* @__PURE__ */ new Date()).toISOString(), error ?? null, runId);
    } else {
      this.db.prepare("UPDATE workflow_runs SET status = ? WHERE id = ?").run(status, runId);
    }
  }
  skipRemaining(runId) {
    this.db.prepare("UPDATE workflow_steps SET status = 'skipped' WHERE run_id = ? AND status IN ('pending','running')").run(runId);
  }
  skipRemainingAfter(runId, stepId) {
    this.db.prepare(
      "UPDATE workflow_steps SET status = 'skipped' WHERE run_id = ? AND status IN ('pending','running') AND rowid > (SELECT rowid FROM workflow_steps WHERE id = ?)"
    ).run(runId, stepId);
  }
  begin() {
    this.db.exec("BEGIN IMMEDIATE");
    return {
      commit: () => this.db.exec("COMMIT"),
      rollback: () => this.db.exec("ROLLBACK")
    };
  }
};
function safeParse(text) {
  if (!text) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// src/host/services/capture-service.ts
var RULES = [
  { pattern: /(最近|latest|newest|最新).{0,24}(论文|papers?|文献)|literature review|文献综述/i, intent: "research.literature-radar", confidence: 0.9 },
  { pattern: /论文|paper|文献|research/i, intent: "research", confidence: 0.55 },
  { pattern: /(老师|导师|advisor|professor).{0,20}(回复|reply|意思|mean)|帮我回复/i, intent: "communication.advisor-reply", confidence: 0.85 },
  { pattern: /老师|导师|advisor/i, intent: "communication", confidence: 0.5 },
  { pattern: /志愿|volunteer|义工/i, intent: "life.ledger-volunteer", confidence: 0.85 },
  { pattern: /(健身|workout|训练).{0,10}(记录|log)|打卡/i, intent: "life.ledger-fitness", confidence: 0.8 },
  { pattern: /(饭店|餐厅|restaurant|店).{0,10}(记|save|收藏)|想吃/i, intent: "life.food-map", confidence: 0.8 },
  { pattern: /(填|fill).{0,8}(表|form)|申请表/i, intent: "automation.form-assistant", confidence: 0.85 }
];
function routeCapture(text) {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { intent: rule.intent, confidence: rule.confidence };
    }
  }
  return { intent: "inbox.unrouted", confidence: 0.2 };
}
var CaptureService = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    const id = crypto.randomUUID();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const source = input.source ?? "dsh";
    const guess = input.text ? routeCapture(input.text) : { intent: "inbox.unrouted", confidence: 0.1 };
    const status = guess.confidence >= 0.5 ? "routed" : "new";
    this.db.prepare(
      `INSERT INTO capture_items (id, created_at, source, source_ref, mime_type, text, inferred_intent, route_confidence, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, createdAt, source, input.sourceRef ?? null, input.mimeType ?? null, input.text ?? null, guess.intent, guess.confidence, status);
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare("SELECT * FROM capture_items WHERE id = ? AND deleted_at IS NULL").get(id);
    if (!row) throw new Error(`capture item not found: ${id}`);
    return {
      id: row.id,
      createdAt: row.created_at,
      source: row.source,
      sourceRef: row.source_ref ?? void 0,
      mimeType: row.mime_type ?? void 0,
      text: row.text ?? void 0,
      inferredIntent: row.inferred_intent ?? void 0,
      routeConfidence: row.route_confidence ?? void 0,
      status: row.status
    };
  }
  list(filter = {}) {
    const clauses = ["deleted_at IS NULL"];
    const params = [];
    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    params.push(filter.limit ?? 50);
    const rows = this.db.prepare(`SELECT id FROM capture_items WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).all(...params);
    return rows.map((r) => this.get(r.id));
  }
  archive(id) {
    this.get(id);
    this.db.prepare("UPDATE capture_items SET status = 'archived' WHERE id = ?").run(id);
    return this.get(id);
  }
};

// src/host/services/memory-service.ts
var MemoryService = class {
  db;
  constructor(db) {
    this.db = db;
  }
  // ── writes ────────────────────────────────────────────────────────────────
  remember(input) {
    if (!input.content || input.content.trim().length === 0) {
      throw errors.invalidInput("memory content must be a non-empty string");
    }
    let superseded;
    if (input.supersedesId) {
      superseded = this.get(input.supersedesId);
      this.db.prepare("UPDATE memory_items SET outdated = 1 WHERE id = ?").run(superseded.id);
    }
    const id = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const scopeType = input.scopeType ?? "global";
    if (scopeType !== "global" && !input.scopeId) {
      throw errors.invalidInput(`scope "${scopeType}" requires a scopeId`);
    }
    this.db.prepare(
      `INSERT INTO memory_items
           (id, scope_type, scope_id, kind, content, source_type, source_ref, confidence,
            created_at, supersedes_id, sensitivity, user_confirmed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      scopeType,
      input.scopeId ?? null,
      input.kind ?? "fact",
      input.content.trim(),
      input.sourceType ?? "workflow",
      input.sourceRef ?? null,
      input.confidence ?? (input.userConfirmed ? 0.95 : 0.6),
      now,
      superseded?.id ?? null,
      input.sensitivity ?? "normal",
      input.userConfirmed ? 1 : 0
    );
    const item = this.get(id);
    this.index(item);
    return item;
  }
  confirm(id) {
    this.get(id);
    this.db.prepare("UPDATE memory_items SET user_confirmed = 1, confidence = MAX(confidence, 0.9) WHERE id = ?").run(id);
    return this.get(id);
  }
  setPinned(id, pinned) {
    this.get(id);
    this.db.prepare("UPDATE memory_items SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, id);
    return this.get(id);
  }
  /** Soft delete; FTS entry removed. Canonical trace stays until hard purge. */
  delete(id) {
    this.get(id);
    this.db.prepare("UPDATE memory_items SET deleted_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
    this.db.prepare("DELETE FROM memory_fts WHERE memory_id = ?").run(id);
  }
  /** Rebuild the FTS index from canonical rows (corruption recovery path). */
  rebuildIndex() {
    this.db.exec("DELETE FROM memory_fts");
    const rows = this.db.prepare("SELECT id, content FROM memory_items WHERE deleted_at IS NULL").all();
    for (const row of rows) {
      this.db.prepare("INSERT INTO memory_fts (memory_id, content) VALUES (?, ?)").run(row.id, row.content);
    }
    return rows.length;
  }
  // ── reads ─────────────────────────────────────────────────────────────────
  get(id) {
    const row = this.db.prepare("SELECT * FROM memory_items WHERE id = ? AND deleted_at IS NULL").get(id);
    if (!row) throw errors.notFound("memory item", id);
    return this.rowToItem(row);
  }
  list(filter = {}) {
    const clauses = ["deleted_at IS NULL"];
    const params = [];
    if (filter.scopeType) {
      clauses.push("scope_type = ?");
      params.push(filter.scopeType);
    }
    if (filter.scopeId) {
      clauses.push("scope_id = ?");
      params.push(filter.scopeId);
    }
    if (filter.kind) {
      clauses.push("kind = ?");
      params.push(filter.kind);
    }
    params.push(filter.limit ?? 100);
    const rows = this.db.prepare(`SELECT * FROM memory_items WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).all(...params);
    return rows.map((r) => this.rowToItem(r));
  }
  /**
   * Hybrid retrieval: lexical FTS + recency decay + pinned boost.
   * Returns WHY each item matched plus provenance metadata.
   */
  search(opts) {
    const limit = opts.limit ?? 10;
    const now = Date.now();
    const candidates = /* @__PURE__ */ new Map();
    try {
      const ftsRows = this.db.prepare(
        `SELECT memory_id, bm25(memory_fts) AS rank FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?`
      ).all(this.sanitizeMatch(opts.query), Math.max(limit * 4, 40));
      for (const row of ftsRows) {
        const item = this.safeGet(row.memory_id);
        if (item) candidates.set(item.id, { item, lexical: 1 / (1 + Math.abs(row.rank)) });
      }
    } catch {
    }
    const cjkTokens = opts.query.split(/\s+/).filter((t) => /[\u4e00-\u9fff]/.test(t) && t.length >= 2);
    if (cjkTokens.length > 0) {
      const clauses = cjkTokens.map(() => "content LIKE ?").join(" OR ");
      const params = cjkTokens.map((t) => `%${t}%`);
      const likeRows = this.db.prepare(`SELECT id FROM memory_items WHERE deleted_at IS NULL AND (${clauses}) LIMIT ?`).all(...params, Math.max(limit * 2, 20));
      for (const row of likeRows) {
        if (!candidates.has(row.id)) {
          const item = this.safeGet(row.id);
          if (item) candidates.set(item.id, { item, lexical: 0.5 });
        }
      }
    }
    for (const item of this.list({ scopeType: opts.scopeType, scopeId: opts.scopeId, limit: 60 })) {
      if (!candidates.has(item.id)) candidates.set(item.id, { item, lexical: 0 });
    }
    const scored = [];
    for (const { item, lexical } of candidates.values()) {
      if (item.sensitivity === "restricted" && opts.includeRestricted !== true) continue;
      if (item.outdated && opts.includeOutdated !== true) continue;
      if (opts.kinds && !opts.kinds.includes(item.kind)) continue;
      if (opts.scopeType && item.scopeType !== "global" && item.scopeType !== opts.scopeType) continue;
      if (opts.scopeId && item.scopeId && item.scopeId !== opts.scopeId && item.scopeType !== "global") continue;
      const ageDays = Math.max(0, (now - Date.parse(item.createdAt)) / 864e5);
      const pinned = (item.pinned ? 0.5 : 0) + (item.userConfirmed ? 0.15 : 0);
      const score = lexical * 2 + pinned;
      if (lexical === 0) continue;
      const whyParts = [];
      if (lexical > 0) whyParts.push(`FTS match on "${opts.query}"`);
      if (item.pinned) whyParts.push("pinned");
      if (ageDays < 7) whyParts.push("recent");
      if (item.userConfirmed) whyParts.push("user-confirmed");
      scored.push({
        item,
        score,
        why: whyParts.length > 0 ? whyParts.join(", ") : "recency fallback",
        ageDays: Math.round(ageDays)
      });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }
  /** Provenance for one run: which memories were used, why, from where, how old. */
  explainRun(runId) {
    const usages = this.db.prepare("SELECT * FROM memory_usage WHERE workflow_run_id = ? ORDER BY used_at").all(runId);
    return usages.flatMap((u) => {
      try {
        const item = this.get(u.memory_id);
        return [{ memory: item, usedAt: u.used_at, why: u.why }];
      } catch {
        return [];
      }
    });
  }
  recordUsage(memoryIds, runId, stepId, why) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const id of [...new Set(memoryIds)]) {
      this.get(id);
      this.db.prepare("INSERT INTO memory_usage (id, memory_id, workflow_run_id, step_id, used_at, why) VALUES (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), id, runId, stepId ?? null, now, why);
    }
  }
  // ── projects ──────────────────────────────────────────────────────────────
  /** Find-or-create a project by name; returns its id (scopeId for project memory). */
  ensureProject(name) {
    const existing = this.db.prepare("SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL").get(name);
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, name, now, now);
    return id;
  }
  // ── internals ─────────────────────────────────────────────────────────────
  index(item) {
    this.db.prepare("DELETE FROM memory_fts WHERE memory_id = ?").run(item.id);
    this.db.prepare("INSERT INTO memory_fts (memory_id, content) VALUES (?, ?)").run(item.id, item.content);
  }
  safeGet(id) {
    try {
      return this.get(id);
    } catch {
      return void 0;
    }
  }
  sanitizeMatch(query) {
    const tokens = query.split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 0);
    if (tokens.length === 0) return '""';
    return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
  }
  rowToItem(row) {
    return {
      id: row.id,
      scopeType: row.scope_type,
      scopeId: row.scope_id ?? void 0,
      kind: row.kind,
      content: row.content,
      sourceType: row.source_type,
      sourceRef: row.source_ref ?? void 0,
      confidence: row.confidence,
      createdAt: row.created_at,
      validFrom: row.valid_from ?? void 0,
      validTo: row.valid_to ?? void 0,
      supersedesId: row.supersedes_id ?? void 0,
      sensitivity: row.sensitivity,
      userConfirmed: row.user_confirmed === 1,
      pinned: row.pinned === 1,
      outdated: row.outdated === 1
    };
  }
};

// src/host/services/communication-service.ts
var RULES2 = {
  relationship: [
    [/(导师|advisor)/i, "advisor"],
    [/(组会|课题组)/i, "advisor"],
    [/(老师|teacher|professor|教授)/i, "teacher"],
    [/(评审|reviewer|审稿)/i, "reviewer"],
    [/(教务|秘书|admin|行政)/i, "admin"],
    [/(学长|学姐|senior|博士兄)/i, "senior"],
    [/(合作者|collaborator|同组)/i, "collaborator"]
  ],
  scenario: [
    [/(催|进度|进展|update|progress|汇报)/i, "progress"],
    [/(批改|修改意见|revision|correction|重写|返修)/i, "correction"],
    [/(组会|会议|meeting|zoom|腾讯会议)/i, "meeting"],
    [/(请假|病假|事假|leave)/i, "leave"],
    [/(答辩|defense|预答辩)/i, "defense"],
    [/(截稿|deadline|截止|投稿|submit)/i, "deadline"],
    [/(记得|别忘了|remind)/i, "reminder"]
  ],
  intent: [
    [/(尽快|马上|今天|今晚|asap|urgent)/i, "urgency"],
    [/(吗|？|\?|是否|能不能|可否)/i, "question"],
    [/(请|麻烦|需要你|希望你|please)/i, "request"],
    [/(记得|别忘了|don't forget)/i, "reminder"],
    [/(通知|告知|announce|inform)/i, "inform"],
    [/(建议|反馈|意见|feedback|comment)/i, "feedback"]
  ]
};
function firstMatch(text, rules, fallback) {
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) return label;
  }
  return fallback;
}
function extractCommitments(text) {
  const commitments = [];
  const sentences = text.split(/(?<=[。！？!?;\n])\s*/);
  const obligationRe = /(需要你|请你|麻烦你|希望你|记得|别忘了|请把|请将|请提交|请发|please|need you to|submit)/i;
  const actionRe = /(发我|提交|完成|回复|交|回我)/;
  const dateRe = /(周[一二三四五六日天]|下[周星期]?[一二三四五六日天]|本[周月末]|今天|明天|后天|\d{1,2}月\d{1,2}[日号]|\d{4}-\d{1,2}-\d{1,2}|before [a-z]+day|by [a-z]+day|friday|monday|sunday|saturday)/i;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const hasObligation = obligationRe.test(trimmed);
    const dueMatch = trimmed.match(dateRe);
    if (hasObligation || dueMatch && actionRe.test(trimmed)) {
      if (trimmed.length <= 120 && (hasObligation ? true : /\d/.test(trimmed) || Boolean(dueMatch))) {
        commitments.push({ what: trimmed, ...dueMatch ? { due: dueMatch[0] } : {} });
      }
    }
  }
  return commitments.slice(0, 5);
}
var CommunicationService = class {
  artifacts;
  memory;
  constructor(artifacts, memory) {
    this.artifacts = artifacts;
    this.memory = memory;
  }
  understand(text) {
    const relationship = firstMatch(text, RULES2.relationship, "unknown");
    const scenario = firstMatch(text, RULES2.scenario, "general");
    const intent = firstMatch(text, RULES2.intent, "inform");
    const risk = intent === "urgency" || scenario === "defense" || scenario === "correction" ? "high" : scenario === "progress" || scenario === "deadline" ? "medium" : "low";
    const keyPoints = text.split(/(?<=[。！？!?;\n])/).map((s) => s.trim()).filter((s) => s.length > 6 && s.length <= 120).slice(0, 5);
    return {
      relationship,
      scenario,
      intent,
      risk,
      keyPoints,
      commitments: extractCommitments(text),
      coreDemand: scenario === "progress" ? "\u5BF9\u65B9\u60F3\u4E86\u89E3\u4F60\u7684\u7814\u7A76\u8FDB\u5C55\uFF08\u4E0D\u8981\u865A\u6784\u8FDB\u5EA6\uFF0C\u53EA\u5F15\u7528\u4F60\u786E\u8BA4\u8FC7\u7684\u4E8B\u5B9E\uFF09" : scenario === "correction" ? "\u5BF9\u65B9\u6307\u51FA\u4E86\u9700\u8981\u4FEE\u6539\u7684\u95EE\u9898\uFF0C\u56DE\u590D\u5E94\u5148\u786E\u8BA4\u6536\u5230\u5E76\u8BF4\u660E\u4FEE\u6539\u8BA1\u5212" : scenario === "meeting" ? "\u5BF9\u65B9\u5728\u534F\u8C03\u4F1A\u8BAE\u65F6\u95F4\uFF0C\u56DE\u590D\u5E94\u660E\u786E\u4F60\u7684\u53EF\u7528\u65F6\u95F4\u6216\u786E\u8BA4\u65F6\u95F4" : scenario === "deadline" ? "\u6D88\u606F\u6D89\u53CA\u622A\u6B62\u65E5\u671F\uFF0C\u56DE\u590D\u5E94\u786E\u8BA4\u4F60\u77E5\u6089\u5E76\u8BF4\u660E\u8BA1\u5212" : "\u5148\u590D\u8FF0\u4F60\u7684\u7406\u89E3\uFF0C\u518D\u7ED9\u51FA\u56DE\u5E94",
      note: "Deterministic keyword-level analysis (MVP). Treat as hints, not ground truth."
    };
  }
  /**
   * Generate tone-varied reply drafts. `userFacts` is the ONLY source of
   * substantive claims; everything else becomes an explicit placeholder.
   */
  draft(input) {
    const u = this.understand(input.originalText);
    const contextUsed = this.memory.search({ query: "\u5BFC\u5E08 advisor \u56DE\u590D \u8BED\u6C14 preference", limit: 3 }).map((r) => ({ id: r.item.id, content: r.item.content, why: r.why }));
    const facts = input.userFacts?.trim();
    const factsBlock = facts ?? "\u3010\u5F85\u586B\u5199\uFF1A\u4F60\u5B9E\u9645\u5B8C\u6210\u7684\u4E8B\u9879\u2014\u2014\u7CFB\u7EDF\u4E0D\u4F1A\u66FF\u4F60\u7F16\u9020\u3011";
    const nextBlock = "\u3010\u5F85\u586B\u5199\uFF1A\u4E0B\u4E00\u6B65\u8BA1\u5212\u3011";
    const formal = [
      `${salutation(u.relationship)}\uFF0C\u60A8\u597D\uFF1A`,
      "",
      `\u6536\u5230\u60A8\u7684\u6D88\u606F\u3002\u5173\u4E8E${scenarioLabel(u.scenario)}\uFF0C\u60C5\u51B5\u5982\u4E0B\uFF1A`,
      "",
      factsBlock,
      "",
      `\u63A5\u4E0B\u6765\u6211\u8BA1\u5212\uFF1A${nextBlock}`,
      "",
      u.commitments.some((c) => c.due) ? `\u6211\u4F1A\u786E\u4FDD\u5728 ${u.commitments.find((c) => c.due).due} \u4E4B\u524D\u5B8C\u6210\u3002` : "\u5982\u6709\u5177\u4F53\u65F6\u95F4\u8981\u6C42\uFF0C\u8BF7\u60A8\u544A\u77E5\uFF0C\u6211\u4F1A\u6309\u65F6\u5B8C\u6210\u3002",
      "",
      "\u795D\u597D\uFF01"
    ].join("\n");
    const warm = [
      `${salutation(u.relationship)}\u597D\uFF01`,
      "",
      "\u770B\u5230\u60A8\u7684\u6D88\u606F\u5566\uFF5E",
      "",
      factsBlock,
      "",
      `\u4E0B\u4E00\u6B65\u6211\u6253\u7B97\uFF1A${nextBlock}`,
      "",
      "\u6709\u4EFB\u4F55\u5176\u4ED6\u5B89\u6392\u9700\u8981\u914D\u5408\u7684\uFF0C\u968F\u65F6\u544A\u8BC9\u6211\uFF01"
    ].join("\n");
    const drafts = [
      { tone: "formal", markdown: formal },
      { tone: "warm", markdown: warm },
      ...input.tone === "formal" || input.tone === "warm" ? [] : [{ tone: "brief", markdown: `${salutation(u.relationship)}\u60A8\u597D\uFF0C\u5DF2\u6536\u5230\u3002\u7B80\u8981\u6C47\u62A5\uFF1A${factsBlock}` }]
    ];
    return { drafts, contextUsed };
  }
  /** Persist a chosen draft as a communication-draft artifact. */
  saveDraft(params) {
    const ref = this.artifacts.put({
      kind: "communication-draft",
      mediaType: "text/markdown",
      bytes: params.markdown,
      sourceRefs: [
        {
          id: `comm-src-${crypto.randomUUID()}`,
          kind: "message",
          ref: params.originalText.slice(0, 200),
          title: "Advisor/teacher original message",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]
    });
    return { artifactId: ref.id };
  }
};
function salutation(relationship) {
  switch (relationship) {
    case "advisor":
      return "\u8001\u5E08";
    case "teacher":
      return "\u8001\u5E08";
    case "reviewer":
      return "\u5C0A\u656C\u7684\u8BC4\u5BA1\u4E13\u5BB6";
    case "admin":
      return "\u8001\u5E08";
    case "senior":
      return "\u5B66\u957F/\u5B66\u59D0";
    case "collaborator":
      return "\u4F60\u597D";
    default:
      return "\u60A8\u597D";
  }
}
function scenarioLabel(scenario) {
  switch (scenario) {
    case "progress":
      return "\u7814\u7A76\u8FDB\u5C55";
    case "correction":
      return "\u4FEE\u6539\u4E8B\u5B9C";
    case "meeting":
      return "\u4F1A\u8BAE\u5B89\u6392";
    case "leave":
      return "\u8BF7\u5047\u4E8B\u5B9C";
    case "defense":
      return "\u7B54\u8FA9\u51C6\u5907";
    case "deadline":
      return "\u622A\u6B62\u65F6\u95F4";
    case "reminder":
      return "\u60A8\u63D0\u9192\u7684\u4E8B\u9879";
    case "request":
      return "\u60A8\u7684\u8BF7\u6C42";
    default:
      return "\u76F8\u5173\u4E8B\u5B9C";
  }
}

// src/host/services/food-service.ts
var FoodService = class {
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Capture a restaurant from text/name. Location is resolved only through an
   * explicit user confirmation — captures stay `unresolved`.
   */
  save(input) {
    if (!input.name || input.name.trim().length === 0) throw errors.invalidInput("restaurant name is required");
    const id = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `INSERT INTO restaurants
           (id, name, aliases, source_texts, tags, cuisines, notes, city, status, first_saved_at)
         VALUES (?, ?, '[]', ?, '[]', ?, ?, ?, 'unresolved', ?)`
    ).run(
      id,
      input.name.trim(),
      JSON.stringify(input.sourceText ? [input.sourceText.slice(0, 500)] : []),
      JSON.stringify(input.cuisine ? [input.cuisine] : []),
      input.note ?? null,
      input.city ?? null,
      now
    );
    return this.get(id);
  }
  /** Confirm WHERE the place is — a user decision, never automatic. */
  confirm(id, place = {}) {
    const current = this.get(id);
    if (!place.address && place.lat === void 0 && place.lng === void 0) {
      throw errors.invalidInput("confirm requires an address or coordinates from the user");
    }
    this.db.prepare(
      `UPDATE restaurants SET status = 'want_to_try', address = COALESCE(?, address), lat = COALESCE(?, lat),
           lng = COALESCE(?, lng), city = COALESCE(?, city) WHERE id = ?`
    ).run(place.address ?? null, place.lat ?? null, place.lng ?? null, place.city ?? null, current.id);
    return this.get(id);
  }
  setStatus(id, status, rating) {
    this.get(id);
    const visitedAt = status === "visited" || status === "favorite" ? (/* @__PURE__ */ new Date()).toISOString() : null;
    this.db.prepare(
      `UPDATE restaurants SET status = ?,
           rating_by_user = COALESCE(?, rating_by_user),
           last_visited_at = COALESCE(?, last_visited_at)
         WHERE id = ?`
    ).run(status, rating ?? null, visitedAt, id);
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare("SELECT * FROM restaurants WHERE id = ? AND deleted_at IS NULL").get(id);
    if (!row) throw errors.notFound("restaurant", id);
    return this.rowToRestaurant(row);
  }
  list(filter = {}) {
    const clauses = ["deleted_at IS NULL"];
    const params = [];
    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    if (filter.query) {
      clauses.push("(name LIKE ? OR tags LIKE ? OR cuisines LIKE ?)");
      const like = `%${filter.query}%`;
      params.push(like, like, like);
    }
    params.push(filter.limit ?? 100);
    const rows = this.db.prepare(`SELECT * FROM restaurants WHERE ${clauses.join(" AND ")} ORDER BY first_saved_at DESC LIMIT ?`).all(...params);
    return rows.map((r) => this.rowToRestaurant(r));
  }
  delete(id) {
    this.get(id);
    this.db.prepare("UPDATE restaurants SET deleted_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
  }
  rowToRestaurant(row) {
    return {
      id: row.id,
      name: row.name,
      aliases: JSON.parse(row.aliases),
      address: row.address ?? void 0,
      lat: row.lat ?? void 0,
      lng: row.lng ?? void 0,
      city: row.city ?? void 0,
      sourceTexts: JSON.parse(row.source_texts),
      tags: JSON.parse(row.tags),
      cuisines: JSON.parse(row.cuisines),
      status: row.status,
      ratingByUser: row.rating_by_user ?? void 0,
      notes: row.notes ?? void 0,
      firstSavedAt: row.first_saved_at,
      lastVisitedAt: row.last_visited_at ?? void 0
    };
  }
};

// src/host/services/ledger-service.ts
function toIso(value, field) {
  const t = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(t.getTime())) throw errors.invalidInput(`${field} is not a valid date`);
  return t.toISOString();
}
var LedgerService = class {
  db;
  constructor(db) {
    this.db = db;
  }
  add(input) {
    if (!input.category) throw errors.invalidInput("category is required");
    const startAt = toIso(input.startAt, "startAt");
    let durationMinutes = input.durationMinutes;
    let endAt;
    if (input.endAt !== void 0 && input.endAt !== null) {
      endAt = toIso(input.endAt, "endAt");
      const diffMin = Math.round((Date.parse(endAt) - Date.parse(startAt)) / 6e4);
      if (diffMin < 0) throw errors.invalidInput("endAt is before startAt");
      durationMinutes = durationMinutes ?? diffMin;
    }
    if (durationMinutes === void 0 && !["fitness"].includes(input.category)) {
      throw errors.invalidInput("provide durationMinutes or an endAt so hours can be counted");
    }
    const id = crypto.randomUUID();
    this.db.prepare(
      `INSERT INTO ledger_entries
           (id, category, start_at, end_at, duration_minutes, organization, activity_type, note, evidence_refs, source, verification, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'self', ?)`
    ).run(
      id,
      input.category,
      startAt,
      endAt ?? null,
      durationMinutes ?? null,
      input.organization ?? null,
      input.activityType ?? null,
      input.note ?? null,
      JSON.stringify(input.evidenceRefs ?? []),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    return this.get(id);
  }
  /** One workout session: ledger entry + linked exercise set rows. */
  addWorkout(input) {
    if (!Array.isArray(input.exercises) || input.exercises.length === 0) {
      throw errors.invalidInput("a workout needs at least one exercise");
    }
    const entry = this.add({
      category: "fitness",
      startAt: input.startAt,
      endAt: input.endAt,
      durationMinutes: input.durationMinutes ?? input.exercises.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0),
      activityType: "workout",
      note: input.note
    });
    for (const ex of input.exercises) {
      this.db.prepare(
        `INSERT INTO fitness_sets (id, ledger_entry_id, exercise, sets, reps, weight_kg, duration_minutes, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        entry.id,
        ex.exercise,
        ex.sets ?? null,
        ex.reps ?? null,
        ex.weightKg ?? null,
        ex.durationMinutes ?? null,
        ex.notes ?? null
      );
    }
    return this.get(entry.id);
  }
  /** Most recent workout with its exercises — the "last time" comparison. */
  lastWorkout() {
    const row = this.db.prepare("SELECT * FROM ledger_entries WHERE category = 'fitness' AND deleted_at IS NULL ORDER BY start_at DESC LIMIT 1").get();
    return row ? this.get(row.id) : void 0;
  }
  get(id) {
    const row = this.db.prepare("SELECT * FROM ledger_entries WHERE id = ? AND deleted_at IS NULL").get(id);
    if (!row) throw errors.notFound("ledger entry", id);
    const sets = this.db.prepare("SELECT id, exercise, sets, reps, weight_kg, duration_minutes FROM fitness_sets WHERE ledger_entry_id = ?").all(id);
    return {
      id: row.id,
      category: row.category,
      startAt: row.start_at,
      endAt: row.end_at ?? void 0,
      durationMinutes: row.duration_minutes ?? void 0,
      organization: row.organization ?? void 0,
      activityType: row.activity_type ?? void 0,
      note: row.note ?? void 0,
      evidenceRefs: JSON.parse(row.evidence_refs ?? "[]"),
      source: row.source,
      verification: row.verification,
      ...sets.length > 0 ? {
        sets: sets.map((s) => ({
          id: s.id,
          exercise: s.exercise,
          sets: s.sets ?? void 0,
          reps: s.reps ?? void 0,
          weightKg: s.weight_kg ?? void 0,
          durationMinutes: s.duration_minutes ?? void 0
        }))
      } : {}
    };
  }
  list(filter = {}) {
    const clauses = ["deleted_at IS NULL"];
    const params = [];
    if (filter.category) {
      clauses.push("category = ?");
      params.push(filter.category);
    }
    if (filter.since) {
      clauses.push("start_at >= ?");
      params.push(filter.since);
    }
    if (filter.until) {
      clauses.push("start_at < ?");
      params.push(filter.until);
    }
    params.push(filter.limit ?? 100);
    const rows = this.db.prepare(`SELECT * FROM ledger_entries WHERE ${clauses.join(" AND ")} ORDER BY start_at DESC LIMIT ?`).all(...params);
    return rows.map((r) => this.get(r.id));
  }
  /** Totals grouped per month and organization/category. */
  summary(filter = {}) {
    const clauses = ["deleted_at IS NULL"];
    const params = [];
    if (filter.category) {
      clauses.push("category = ?");
      params.push(filter.category);
    }
    if (filter.year) {
      clauses.push("start_at LIKE ?");
      params.push(`${filter.year}-%`);
    }
    const rows = this.db.prepare(`SELECT * FROM ledger_entries WHERE ${clauses.join(" AND ")}`).all(...params);
    let totalMinutes = 0;
    const byMonth = {};
    const byOrganization = {};
    for (const r of rows) {
      const minutes = r.duration_minutes ?? 0;
      totalMinutes += minutes;
      const month = String(r.start_at).slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + minutes;
      if (r.organization) {
        byOrganization[r.organization] = (byOrganization[r.organization] ?? 0) + minutes;
      }
    }
    return { totalMinutes, byMonth, byOrganization, count: rows.length };
  }
  delete(id) {
    this.get(id);
    this.db.prepare("UPDATE ledger_entries SET deleted_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
  }
  exportCsv(category) {
    const rows = this.list({ category, limit: 1e4 });
    const header = "id,category,startAt,endAt,durationMinutes,organization,activityType,note,evidenceRefs";
    const lines = rows.map(
      (r) => [
        r.id,
        r.category,
        r.startAt,
        r.endAt ?? "",
        String(r.durationMinutes ?? ""),
        r.organization ?? "",
        r.activityType ?? "",
        (r.note ?? "").replace(/"/g, "'"),
        `"${r.evidenceRefs.join(";")}"`
      ].join(",")
    );
    return [header, ...lines].join("\n");
  }
};

// src/host/services/form-service.ts
import { createHash as createHash3 } from "node:crypto";
var MockFormAutomation = class {
  id = "mock";
  async inspect(url) {
    const fp = createHash3("sha256").update(url).digest("hex").slice(0, 12);
    return {
      url,
      title: `Form at ${new URL(url).host}`,
      domFingerprint: fp,
      fields: [
        { label: "\u59D3\u540D", required: true, inputType: "text" },
        { label: "\u5B66\u53F7", required: true, inputType: "text" },
        { label: "\u8054\u7CFB\u7535\u8BDD", required: true, inputType: "text" },
        { label: "\u7533\u8BF7\u7C7B\u578B", required: true, inputType: "select" },
        { label: "\u63D0\u4EA4\u65E5\u671F", required: false, inputType: "date" }
      ]
    };
  }
  async fill(schema, values) {
    if (Object.keys(values).length === 0) return { ok: false, filledFields: [], error: "no values to fill" };
    return { ok: true, filledFields: schema.fields.map((f) => f.label) };
  }
  async submit(schema) {
    const ref = createHash3("sha256").update(`${schema.url}:${schema.domFingerprint}`).digest("hex").slice(0, 16);
    return { ok: true, confirmationRef: `MOCK-${ref}` };
  }
};
var FormService = class {
  db;
  automation;
  /** In-flight plans keyed by plan id (small, process-local). */
  plans = /* @__PURE__ */ new Map();
  constructor(db, automation = new MockFormAutomation()) {
    this.db = db;
    this.automation = automation;
  }
  // ── profile vault ─────────────────────────────────────────────────────────
  saveProfileField(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `INSERT INTO form_profile_fields (id, field_key, label, value, sensitivity, user_confirmed, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(field_key) DO UPDATE SET value = excluded.value, label = excluded.label,
           sensitivity = excluded.sensitivity, user_confirmed = excluded.user_confirmed, updated_at = excluded.updated_at`
    ).run(
      crypto.randomUUID(),
      input.fieldKey,
      input.label,
      input.value,
      input.sensitivity ?? "normal",
      input.userConfirmed === false ? 0 : 1,
      now
    );
    return this.getProfileField(input.fieldKey);
  }
  getProfileField(fieldKey) {
    const row = this.db.prepare("SELECT * FROM form_profile_fields WHERE field_key = ? AND deleted_at IS NULL").get(fieldKey);
    if (!row) return void 0;
    return {
      fieldKey: row.field_key,
      label: row.label,
      value: row.value,
      sensitivity: row.sensitivity,
      userConfirmed: row.user_confirmed === 1
    };
  }
  listProfile() {
    const rows = this.db.prepare("SELECT field_key FROM form_profile_fields WHERE deleted_at IS NULL ORDER BY label").all();
    return rows.map((r) => this.getProfileField(r.field_key)).filter(Boolean);
  }
  // ── inspection + proposals ────────────────────────────────────────────────
  /** Inspect the form, propose values with per-field sources, store the plan. */
  async inspectAndPropose(url) {
    const schema = await this.automation.inspect(url);
    const recipe = this.matchRecipe(url, schema.domFingerprint);
    const proposals = [];
    const values = {};
    for (const field of schema.fields) {
      const match = this.matchProfileField(field.label);
      if (match && match.sensitivity !== "restricted") {
        proposals.push({ label: field.label, value: match.value, source: `profile:${match.fieldKey}`, needsUserInput: false });
        values[field.label] = match.value;
      } else if (match) {
        proposals.push({
          label: field.label,
          source: `profile:${match.fieldKey} (SENSITIVE \u2014 not auto-filled; ask the user)`,
          needsUserInput: true
        });
      } else {
        proposals.push({ label: field.label, source: "user input needed", needsUserInput: true });
      }
    }
    const planId = crypto.randomUUID();
    this.plans.set(planId, { schema, proposals, values, filled: false });
    return { planId, schema, proposals, recipeMatched: Boolean(recipe) };
  }
  // ── two-gate execution ────────────────────────────────────────────────────
  /**
   * FILL gate: consumes the form.fill approval bound to this exact plan payload.
   */
  async executeFill(planId, approval, actionPayload) {
    const plan = this.requirePlan(planId);
    verifyGate(approval, actionPayload ?? plan.values);
    const outcome = await this.automation.fill(plan.schema, plan.values);
    if (outcome.ok) plan.filled = true;
    return outcome;
  }
  /**
   * SUBMIT gate: refuses to run before fill succeeded; consumes its own approval.
   */
  async executeSubmit(planId, approval, actionPayload) {
    const plan = this.requirePlan(planId);
    verifyGate(approval, actionPayload ?? plan.values);
    if (!plan.filled) throw errors.invalidInput("submit refused: the form has not been filled yet (fill must complete first)");
    return this.automation.submit(plan.schema);
  }
  /** Persist a deterministic recipe after a successful run. */
  saveRecipe(url, schema) {
    const pattern = new URL(url).origin + new URL(url).pathname.replace(/[^/]+$/, "*");
    this.db.prepare(
      `INSERT INTO form_recipes (id, url_pattern, title, dom_fingerprint, field_map, last_success_at, created_at)
         VALUES (?, ?, ?, ?, '{}', ?, ?)
         ON CONFLICT(url_pattern) DO UPDATE SET dom_fingerprint = excluded.dom_fingerprint,
           last_success_at = excluded.last_success_at`
    ).run(
      crypto.randomUUID(),
      pattern,
      schema.title ?? null,
      schema.domFingerprint,
      (/* @__PURE__ */ new Date()).toISOString(),
      (/* @__PURE__ */ new Date()).toISOString()
    );
  }
  matchRecipe(url, domFingerprint) {
    let pattern;
    try {
      pattern = new URL(url).origin + new URL(url).pathname.replace(/[^/]+$/, "*");
    } catch {
      return void 0;
    }
    const row = this.db.prepare("SELECT id, dom_fingerprint FROM form_recipes WHERE url_pattern = ? AND deleted_at IS NULL").get(pattern);
    if (!row) return void 0;
    return { id: row.id, stale: row.dom_fingerprint !== domFingerprint };
  }
  // ── internals ─────────────────────────────────────────────────────────────
  requirePlan(planId) {
    const plan = this.plans.get(planId);
    if (!plan) throw errors.notFound("form plan", planId);
    return plan;
  }
  matchProfileField(label) {
    const norm = label.toLowerCase().replace(/\s+/g, "");
    return this.listProfile().find((f) => f.label.toLowerCase() === norm) ?? this.listProfile().find((f) => norm.includes(f.fieldKey.toLowerCase()) || f.fieldKey.toLowerCase().includes(norm));
  }
};
function verifyGate(approval, actionPayload) {
  const presented = createHash3("sha256").update(JSON.stringify(actionPayload ?? null)).digest("hex");
  if (approval.payloadHash !== presented) {
    throw errors.approvalInvalid("gate", "payload hash does not match \u2014 approval invalidated");
  }
  if (approval.status !== "consumed") {
    throw errors.approvalInvalid("gate", `approval gate not run (status "${approval.status}")`);
  }
}

// src/host/skills/catalog.ts
function makeSkills(services) {
  const researchRadar = {
    manifest: {
      id: "academic-retrieval",
      version: "0.1.0",
      title: "Academic retrieval (latest papers)",
      description: "Collects the latest unique papers on a topic via provider layer with dedup.",
      requiredInputs: ["topic"],
      outputs: ["collectionId", "delivered", "complete"],
      externalSideEffect: false,
      requiredTools: ["grad_research_latest"]
    },
    async execute(input) {
      const a = input;
      const collection = await services.research.latest({ topic: String(a.topic ?? ""), count: a.count ?? 50, since: a.since });
      return {
        collectionId: collection.id,
        delivered: collection.papers.length,
        requested: collection.requestedCount,
        complete: collection.complete,
        note: collection.notes
      };
    }
  };
  const synthesis = {
    manifest: {
      id: "literature-synthesis",
      version: "0.1.0",
      title: "Cited literature synthesis (deterministic)",
      description: "Renders an evidence-tagged Markdown report from a stored paper collection.",
      requiredInputs: ["collectionId"],
      outputs: ["reportArtifactId", "reportWarnings"],
      externalSideEffect: false,
      requiredTools: ["grad_research_synthesize"]
    },
    execute(input, ctx) {
      const collectionId = input.collectionId;
      if (!collectionId) throw new Error("literature-synthesis requires collectionId from a previous step");
      ctx.recordToolCall("artifact.write_markdown", true);
      const result = services.research.synthesizeToArtifact(collectionId);
      return { reportArtifactId: result.artifactId, reportWarnings: result.warnings };
    }
  };
  const feishuPublish = {
    manifest: {
      id: "feishu-publish-doc",
      version: "0.1.0",
      title: "Feishu document publish (approval-gated)",
      description: "Creates a Feishu document from Markdown content behind an explicit user approval.",
      requiredInputs: ["markdown"],
      outputs: ["published", "externalRef"],
      externalSideEffect: true,
      requiredTools: ["grad_feishu_prepare_publish"]
    },
    // Both gate and execute derive the SAME action object so the stored
    // approval payload hash matches what is executed.
    buildAction(input) {
      return {
        type: "doc.create",
        title: String(input.title ?? "Graduate OS export"),
        markdown: String(input.markdown ?? "")
      };
    },
    requiresApprovals(input) {
      const action = this.buildAction(input);
      return [
        {
          actionType: "feishu.doc.create",
          summary: `Create Feishu document "${action.title}"`,
          payload: action,
          destination: "Feishu Docs"
        }
      ];
    },
    async execute(input, ctx) {
      ctx.recordToolCall("feishu.publish", true);
      const action = this.buildAction(input);
      const approvals = services.approvals.list({ workflowRunId: ctx.runId });
      const mine = approvals.find((x) => x.stepId === ctx.stepId && x.status === "consumed");
      if (!mine) throw new Error("approval gate did not consume the publish approval");
      const result = await services.connectors.require("feishu").execute(action, { approval: mine });
      return { published: result.ok, ...result.error ? { error: result.error } : {}, ...result.externalRef ? { externalRef: result.externalRef } : {} };
    }
  };
  const memoryNote = {
    manifest: {
      id: "memory-note",
      version: "0.1.0",
      title: "Save a confirmed memory note",
      description: "Stores a short note into scoped memory as user-confirmed fact.",
      requiredInputs: ["note"],
      outputs: ["memoryId"],
      externalSideEffect: false,
      requiredTools: ["grad_memory_remember"]
    },
    execute(input) {
      const note = String(input.note ?? "").trim();
      if (!note) throw new Error("memory-note requires note text");
      const item = services.memory.remember({ content: note, sourceType: "workflow", userConfirmed: true });
      return { memoryId: item.id };
    }
  };
  return {
    "academic-retrieval": researchRadar,
    "literature-synthesis": synthesis,
    "feishu-publish-doc": feishuPublish,
    "memory-note": memoryNote
  };
}
function createSkillCatalog(services) {
  return makeSkills(services);
}

// src/host/skills/recipe-compiler.ts
var RecipeValidationError = class extends Error {
  problems;
  constructor(problems) {
    super(`recipe invalid: ${problems.join("; ")}`);
    this.name = "RecipeValidationError";
    this.problems = problems;
  }
};
function compileRecipe(catalog, services, spec) {
  const problems = [];
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    problems.push("recipe needs at least one step");
  }
  const seen = /* @__PURE__ */ new Set();
  for (const [i, step] of (spec.steps ?? []).entries()) {
    const skill = catalog[step?.skillId];
    if (!skill) {
      problems.push(`step ${i + 1}: unknown skill "${String(step?.skillId)}"`);
      continue;
    }
    if (seen.has(step.skillId)) problems.push(`step ${i + 1}: duplicate skill "${step.skillId}"`);
    seen.add(step.skillId);
  }
  if (problems.length > 0) throw new RecipeValidationError(problems);
  const available = /* @__PURE__ */ new Set(["topic", "note", "title", "markdown", "userFacts"]);
  const warnings = [];
  const producedBy = {};
  for (const [i, step] of spec.steps.entries()) {
    const skill = catalog[step.skillId];
    const missing = skill.manifest.requiredInputs.filter((key) => !available.has(key));
    if (missing.length > 0 && !spec.steps.slice(0, i).some((s) => Boolean(s.staticInput) && missing.every((k) => k in s.staticInput))) {
      warnings.push(`step ${i + 1} (${skill.manifest.id}) expects inputs not produced earlier: ${missing.join(", ")}`);
    }
    for (const out of skill.manifest.outputs) available.add(out);
    for (const key of Object.keys(step.staticInput ?? {})) available.add(key);
    void producedBy;
  }
  const steps = spec.steps.map((step, index) => {
    const skill = catalog[step.skillId];
    const isGateOwner = skill.manifest.externalSideEffect;
    const mergedView = (input) => mergeInputs(input, step.staticInput);
    return {
      name: `${index + 1}. ${skill.manifest.title}`,
      skillId: skill.manifest.id,
      requiresApprovals: skill.requiresApprovals !== void 0 || isGateOwner ? (input) => {
        const merged = mergedView(input);
        return skill.requiresApprovals ? skill.requiresApprovals(merged) : [
          {
            actionType: `external.${skill.manifest.id}`,
            summary: `External side effect via ${skill.manifest.title}`,
            payload: merged,
            destination: "external system"
          }
        ];
      } : void 0,
      execute(input, engineCtx) {
        return skill.execute(mergedView(input), { ...engineCtx, services });
      }
    };
  });
  const definition = {
    id: spec.id,
    version: spec.version ?? "0.1.0",
    title: spec.title,
    description: `Composed recipe: ${spec.steps.map((s) => s.skillId).join(" \u2192 ")}`,
    validateInput(input) {
      if (typeof input !== "object" || input === null) throw errors.invalidInput("recipe input must be an object");
      return input;
    },
    steps
  };
  return { definition, warnings };
}
function mergeInputs(dynamic, staticInput) {
  if (!staticInput) return dynamic;
  const base = typeof dynamic === "object" && dynamic !== null ? dynamic : {};
  return { ...base, ...staticInput };
}

// src/host/services/skill-studio.ts
var SkillStudioService = class {
  catalog;
  recipes = /* @__PURE__ */ new Map();
  services;
  constructor(services) {
    this.services = services;
    this.catalog = createSkillCatalog(services);
  }
  listSkills() {
    return Object.values(this.catalog).map((s) => s.manifest).sort((a, b) => a.id.localeCompare(b.id));
  }
  getSkill(id) {
    return this.catalog[id]?.manifest;
  }
  /**
   * Validate + compile a recipe and register it as a runnable workflow.
   * Throws RecipeValidationError with all problems listed.
   */
  compose(spec) {
    if (!spec.title || spec.title.trim().length === 0) throw errors.invalidInput("recipe title is required");
    const recipeId = `recipe-${crypto.randomUUID().slice(0, 8)}`;
    let result;
    try {
      result = compileRecipe(this.catalog, this.services, {
        id: recipeId,
        version: "0.1.0",
        title: spec.title.trim(),
        steps: spec.steps
      });
    } catch (err) {
      if (err instanceof RecipeValidationError) throw errors.invalidInput(err.message);
      throw err;
    }
    this.recipes.set(recipeId, { definition: result.definition, dispose: this.services.workflows.register(result.definition) });
    return { recipeId, warnings: result.warnings };
  }
  listRecipes() {
    return [...this.recipes.entries()].map(([id, r]) => ({
      recipeId: id,
      title: r.definition.title,
      steps: r.definition.description ?? ""
    }));
  }
  disposeAll() {
    for (const { dispose } of this.recipes.values()) dispose();
    this.recipes.clear();
  }
};

// src/host/services/audio-brief.ts
var AudioBriefService = class {
  artifacts;
  ttsProvider;
  constructor(artifacts, ttsProvider) {
    this.artifacts = artifacts;
    this.ttsProvider = ttsProvider;
  }
  /** Turn report Markdown into a ~20-minute listening script. */
  generateScript(reportMarkdown) {
    const lines = reportMarkdown.split("\n");
    const titleLine = lines.find((l) => l.startsWith("# "))?.slice(2).trim() ?? "Research update";
    const themeLines = lines.filter((l) => l.trim().startsWith("- ") && l.includes("Theme")).slice(0, 6);
    const readFirstIdx = lines.indexOf("## 9. What to read first");
    const readFirst = readFirstIdx >= 0 ? lines.slice(readFirstIdx + 1).filter((l) => /^\d+\./.test(l)).slice(0, 3) : [];
    const sections = [];
    sections.push(`[00:00] \u5F00\u573A\uFF1A${titleLine}\u3002\u672C\u671F\u7528\u5927\u7EA6\u4E8C\u5341\u5206\u949F\uFF0C\u5E26\u4F60\u4E86\u89E3\u8FD9\u4E2A\u65B9\u5411\u6700\u8FD1\u503C\u5F97\u5173\u6CE8\u7684\u8BBA\u6587\u3002`);
    sections.push("[01:00] \u8303\u56F4\u4E0E\u65B9\u6CD5\uFF1A\u4EE5\u4E0B\u5185\u5BB9\u57FA\u4E8E\u516C\u5F00\u5143\u6570\u636E\u4E0E\u6458\u8981\u6574\u7406\uFF0C\u6240\u6709\u7ED3\u8BBA\u90FD\u6807\u6CE8\u4E86\u8BC1\u636E\u7EA7\u522B\uFF0C\u672A\u9605\u8BFB\u5168\u6587\u7684\u90E8\u5206\u4F1A\u660E\u786E\u8BF4\u660E\u3002");
    if (themeLines.length > 0) {
      sections.push("[03:00] \u4E3B\u8981\u4E3B\u9898\uFF1A");
      for (const t of themeLines) sections.push(`  \xB7 ${t.replace(/^- /, "").replace(/\*\*/g, "")}`);
    }
    if (readFirst.length > 0) {
      sections.push("[15:00] \u5EFA\u8BAE\u4F18\u5148\u9605\u8BFB\uFF1A");
      for (const r of readFirst) sections.push(`  \xB7 ${r.replace(/^\d+\.\s*/, "")}`);
    }
    sections.push("[18:00] \u7814\u7A76\u7A7A\u767D\uFF1A\u5B8C\u6574\u7684\u65B9\u6CD5\u8BBA\u5BF9\u6BD4\u9700\u8981\u5168\u6587\u8BC1\u636E\uFF0C\u672C\u811A\u672C\u4EC5\u7ED9\u51FA\u4E3B\u9898\u8986\u76D6\u5EA6\u4FE1\u53F7\u3002");
    sections.push("[19:30] \u7ED3\u5C3E\uFF1A\u4EE5\u4E0A\u8BBA\u6587\u5217\u8868\u4E0E\u5F15\u7528\u6765\u6E90\u89C1\u914D\u5957\u7684\u6587\u5B57\u62A5\u544A\u3002");
    return sections.join("\n\n");
  }
  async createBrief(input) {
    const { text } = this.artifacts.readText(input.reportArtifactId);
    const script = this.generateScript(text);
    const scriptRef = this.artifacts.put({
      kind: "audio-script",
      mediaType: "text/markdown",
      bytes: script,
      sourceRefs: [
        {
          id: `report-${input.reportArtifactId}`,
          kind: "artifact",
          ref: input.reportArtifactId,
          title: "Source research report",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]
    });
    if (!this.ttsProvider) {
      return { scriptArtifactId: scriptRef.id, audioAvailable: false };
    }
    const synth = await this.ttsProvider.synthesize(script);
    const audioRef = this.artifacts.put({
      kind: "audio-file",
      mediaType: synth.mediaType,
      bytes: synth.bytes
    });
    return { scriptArtifactId: scriptRef.id, audioAvailable: true, audioArtifactId: audioRef.id };
  }
};

// src/host/research/index.ts
import { join as join4 } from "node:path";

// src/host/research/collection-builder.ts
import { createHash as createHash4 } from "node:crypto";

// src/host/research/dedup.ts
function paperFingerprint(p) {
  const normTitle = p.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  const firstAuthor = (p.authors?.[0] ?? "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  return createFingerprint(`${normTitle}|${p.year ?? ""}|${firstAuthor}`);
}
function createFingerprint(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
function dedupePapers(raw) {
  const keyToIndex = /* @__PURE__ */ new Map();
  const groups = [];
  for (const paper of raw) {
    const keys = [
      paper.doi ? `doi:${paper.doi}` : void 0,
      paper.openAlexId ? `oa:${paper.openAlexId}` : void 0,
      paper.s2Id ? `s2:${paper.s2Id}` : void 0,
      `fp:${paperFingerprint(paper)}`
    ].filter((k) => Boolean(k));
    const existingIdx = keys.map((k) => keyToIndex.get(k)).find((idx) => idx !== void 0);
    if (existingIdx === void 0) {
      const idx = groups.length;
      groups.push({ primary: paper, extras: [] });
      for (const k of keys) keyToIndex.set(k, idx);
    } else {
      const group = groups[existingIdx];
      group.extras.push(paper);
      for (const k of keys) keyToIndex.set(k, existingIdx);
      mergeFields(group.primary, paper);
    }
  }
  const unique = groups.map((g) => g.primary);
  return { unique, merged: raw.length - unique.length };
}
function mergeFields(target, dup) {
  if (!target.abstractAvailable && dup.abstractAvailable) {
    target.abstractAvailable = true;
    target.evidenceLevel = "abstract";
  }
  target.citationCount ??= dup.citationCount;
  target.openAccess ??= dup.openAccess;
  target.venue ??= dup.venue;
  target.year ??= dup.year;
  target.doi ??= dup.doi;
  target.openAlexId ??= dup.openAlexId;
  target.s2Id ??= dup.s2Id;
  if ((dup.relevanceScore ?? 0) > (target.relevanceScore ?? 0)) target.relevanceScore = dup.relevanceScore;
  target.sourceRefs = [...target.sourceRefs, ...dup.sourceRefs.filter((s) => !target.sourceRefs.some((t) => t.ref === s.ref))];
}

// src/host/research/collection-builder.ts
var CollectionStore = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    const id = crypto.randomUUID();
    this.db.prepare(
      `INSERT INTO paper_collections (id, topic, query_spec, requested_count, complete, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`
    ).run(id, input.topic, JSON.stringify(input.querySpec), input.requestedCount, (/* @__PURE__ */ new Date()).toISOString());
    return {
      id,
      topic: input.topic,
      querySpec: input.querySpec,
      requestedCount: input.requestedCount,
      papers: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      complete: false
    };
  }
  addPaper(collectionId, paper, opts = {}) {
    this.db.prepare(
      `INSERT OR IGNORE INTO papers
           (id, collection_id, title, authors, year, date, venue, doi, openalex_id, s2_id,
            citation_count, open_access, abstract_available, abstract_text, relevance_score, theme, evidence_level, fingerprint, selected, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      paper.id,
      collectionId,
      paper.title,
      JSON.stringify(paper.authors),
      paper.year ?? null,
      paper.date ?? null,
      paper.venue ?? null,
      paper.doi ?? null,
      paper.openAlexId ?? null,
      paper.s2Id ?? null,
      paper.citationCount ?? null,
      paper.openAccess === void 0 ? null : paper.openAccess ? 1 : 0,
      paper.abstractAvailable ? 1 : 0,
      paper.abstractText ?? null,
      paper.relevanceScore ?? null,
      paper.theme ?? null,
      paper.evidenceLevel,
      fingerprintOf(paper),
      opts.selected === false ? 0 : 1,
      (/* @__PURE__ */ new Date()).toISOString()
    );
  }
  finalize(collectionId, complete, notes) {
    this.db.prepare("UPDATE paper_collections SET complete = ?, notes = ? WHERE id = ?").run(complete ? 1 : 0, notes ?? null, collectionId);
  }
  get(collectionId) {
    const col = this.db.prepare("SELECT * FROM paper_collections WHERE id = ? AND deleted_at IS NULL").get(collectionId);
    if (!col) return void 0;
    const paperRows = this.db.prepare("SELECT * FROM papers WHERE collection_id = ? AND selected = 1 ORDER BY year DESC, citation_count DESC").all(collectionId);
    return {
      id: col.id,
      topic: col.topic,
      querySpec: JSON.parse(col.query_spec ?? "{}"),
      requestedCount: col.requested_count,
      complete: col.complete === 1,
      notes: col.notes ?? void 0,
      createdAt: col.created_at,
      papers: paperRows.map((r) => ({
        id: r.id,
        title: r.title,
        authors: JSON.parse(r.authors ?? "[]"),
        year: r.year ?? void 0,
        date: r.date ?? void 0,
        venue: r.venue ?? void 0,
        doi: r.doi ?? void 0,
        openAlexId: r.openalex_id ?? void 0,
        s2Id: r.s2_id ?? void 0,
        citationCount: r.citation_count ?? void 0,
        openAccess: r.open_access === null ? void 0 : r.open_access === 1,
        abstractAvailable: r.abstract_available === 1,
        relevanceScore: r.relevance_score ?? void 0,
        theme: r.theme ?? void 0,
        evidenceLevel: r.evidence_level,
        sourceRefs: []
      }))
    };
  }
  list(limit = 20) {
    const rows = this.db.prepare(
      `SELECT c.id, c.topic, c.complete, c.created_at,
                (SELECT COUNT(*) FROM papers p WHERE p.collection_id = c.id) AS count
         FROM paper_collections c WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC LIMIT ?`
    ).all(limit);
    return rows.map((r) => ({
      id: r.id,
      topic: r.topic,
      count: r.count,
      complete: r.complete === 1,
      createdAt: r.created_at
    }));
  }
};
function fingerprintOf(p) {
  const normTitle = p.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  let hash = 2166136261;
  const text = `${normTitle}|${p.year ?? ""}|${(p.authors[0] ?? "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return createHash4("sha256").update(text + hash.toString(16)).digest("hex");
}
var CollectionBuilder = class {
  store;
  providers;
  constructor(store, providers) {
    this.store = store;
    this.providers = providers;
  }
  async build(input) {
    const count = Math.max(1, input.count ?? 50);
    const collection = this.store.create({
      topic: input.topic,
      requestedCount: count,
      querySpec: { topic: input.topic, since: input.since ?? null, poolFactor: input.poolFactor ?? 3 }
    });
    const query = {
      topic: input.topic,
      target: count,
      since: input.since,
      poolFactor: input.poolFactor ?? 3
    };
    const notes = [];
    const raw = [];
    for (const provider of this.providers) {
      try {
        const page = await provider.search(query);
        raw.push(...page.papers);
        if (page.note) notes.push(`${provider.id}: ${page.note}`);
      } catch (err) {
        notes.push(`${provider.id}: unavailable (${err instanceof Error ? err.message : String(err)})`);
      }
    }
    if (raw.length === 0) {
      const note = `No provider returned results. ${notes.join("; ")}`.trim();
      this.store.finalize(collection.id, false, note);
      return { ...collection, complete: false, notes: note };
    }
    const { unique } = dedupePapers(raw);
    const ranked = [...unique].sort((a, b) => {
      const relDiff = (b.relevanceScore ?? b.citationCount ?? 0) - (a.relevanceScore ?? a.citationCount ?? 0);
      if (Math.abs(relDiff) > 1e-9) return relDiff;
      return (b.year ?? 0) - (a.year ?? 0);
    });
    ranked.forEach((paper, i) => this.store.addPaper(collection.id, paper, { selected: i < count }));
    const selected = ranked.slice(0, count);
    const complete = selected.length >= count;
    if (!complete) {
      notes.push(`requested ${count} unique papers, corpus yielded ${ranked.length}`);
    }
    this.store.finalize(collection.id, complete, notes.length > 0 ? notes.join("; ") : void 0);
    return {
      ...collection,
      papers: selected,
      poolSize: ranked.length,
      complete,
      ...notes.length > 0 ? { notes: notes.join("; ") } : {}
    };
  }
};

// src/host/research/providers/openalex.ts
import { createHash as createHash6 } from "node:crypto";

// src/host/research/provider-http.ts
import { createHash as createHash5 } from "node:crypto";
import { mkdirSync as mkdirSync3, existsSync, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3 } from "node:path";
var MAILTO = "grad-workbench@example.com";
async function fetchJsonCached(url, opts = {}) {
  const cacheKey = createHash5("sha256").update(url).digest("hex");
  const cachePath = opts.cacheDir ? join3(opts.cacheDir, `${cacheKey}.json`) : void 0;
  if (cachePath && !opts.bypassCache && existsSync(cachePath)) {
    return JSON.parse(readFileSync2(cachePath, "utf8"));
  }
  const timeoutMs = opts.timeoutMs ?? 2e4;
  const retries = opts.retries ?? 2;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": `dsh-grad-workbench (mailto:${MAILTO})` },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        if (attempt < retries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1e3 : 2 ** attempt * 1500;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (cachePath) {
        mkdirSync3(opts.cacheDir, { recursive: true });
        writeFileSync2(cachePath, JSON.stringify(data));
      }
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < retries && !(err instanceof Error && err.name === "TimeoutError")) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1500));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// src/host/research/providers/openalex.ts
function abstractFromInvertedIndex(inv) {
  const positions = [];
  for (const [word, idxs] of Object.entries(inv)) {
    for (const pos of idxs) positions.push({ pos, word });
  }
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((p) => p.word).join(" ");
}
function normalizeDoi(doi) {
  if (!doi) return void 0;
  return doi.replace(/^https?:\/\/doi\.org\//i, "").toLowerCase();
}
function workToPaper(work, sourceRefs = []) {
  const abstract = work.abstract_inverted_index ? abstractFromInvertedIndex(work.abstract_inverted_index) : void 0;
  return {
    id: crypto.randomUUID(),
    title: work.display_name ?? "(untitled)",
    authors: (work.authorships ?? []).map((a) => a.author?.display_name ?? "").filter(Boolean),
    year: work.publication_year,
    date: work.publication_date,
    venue: work.primary_location?.source?.display_name ?? void 0,
    doi: normalizeDoi(work.doi),
    openAlexId: work.id ? work.id.replace("https://openalex.org/", "") : void 0,
    citationCount: work.cited_by_count,
    openAccess: work.open_access?.is_oa,
    abstractAvailable: Boolean(abstract),
    relevanceScore: work.relevance_score,
    evidenceLevel: abstract ? "abstract" : "metadata",
    sourceRefs
  };
}
var OpenAlexProvider = class {
  id = "openalex";
  opts;
  constructor(opts = {}) {
    this.opts = opts;
  }
  async search(query) {
    const perPage = Math.min(Math.max(query.target * (query.poolFactor ?? 3), query.target), 200);
    const params = new URLSearchParams({
      search: query.topic,
      "per-page": String(Math.max(perPage, 1)),
      page: "1",
      mailto: "grad-workbench@example.com"
    });
    if (query.since) {
      const from = /^\d{4}$/.test(query.since) ? `${query.since}-01-01` : query.since;
      params.set("filter", `from_publication_date:${from}`);
    }
    const url = `https://api.openalex.org/works?${params.toString()}`;
    const data = await fetchJsonCached(url, this.opts);
    if (data.error || data.message) {
      const note = `${data.error ?? "error"}: ${data.message ?? "unknown provider message"}`;
      return { papers: [], note };
    }
    const papers = (data.results ?? []).map((w) => {
      const refHash = createHash6("sha256").update(w.id ?? w.display_name ?? "").digest("hex").slice(0, 16);
      return workToPaper(w, [
        { id: `openalex-${refHash}`, kind: "provider-record", ref: w.id ?? "", createdAt: (/* @__PURE__ */ new Date()).toISOString() }
      ]);
    });
    return { papers, totalEstimate: data.meta?.count };
  }
};

// src/host/research/providers/semanticscholar.ts
var SemanticScholarProvider = class {
  id = "semanticscholar";
  opts;
  constructor(opts = {}) {
    this.opts = opts;
  }
  async search(query) {
    const limit = Math.min(Math.max(query.target, 1), 100);
    const params = new URLSearchParams({
      query: query.topic,
      limit: String(limit),
      fields: "title,year,abstract,citationCount,venue,authors,externalIds"
    });
    if (query.since) {
      const year = /^\d{4}$/.test(query.since) ? Number(query.since) : Number(query.since.slice(0, 4));
      if (Number.isFinite(year)) params.set("year", `${year}-`);
    }
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;
    try {
      const data = await fetchJsonCached(url, { ...this.opts, retries: this.opts.retries ?? 1 });
      const papers = (data.data ?? []).map((p) => ({
        id: crypto.randomUUID(),
        title: p.title ?? "(untitled)",
        authors: (p.authors ?? []).map((a) => a.name ?? "").filter(Boolean),
        year: p.year,
        venue: p.venue || void 0,
        doi: p.externalIds?.DOI?.toLowerCase(),
        s2Id: p.paperId,
        citationCount: p.citationCount,
        openAccess: void 0,
        abstractAvailable: Boolean(p.abstract),
        evidenceLevel: p.abstract ? "abstract" : "metadata",
        sourceRefs: []
      }));
      return { papers, totalEstimate: data.total };
    } catch (err) {
      return { papers: [], note: `semanticscholar unavailable: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
};

// src/host/research/synthesis.ts
import { createHash as createHash7 } from "node:crypto";
var STOPWORDS = new Set(
  "a an the and or of for in on to with via by using based we our their this that these those study studies paper research approach method methods model models framework system systems novel propose proposed proposes show shows shown results result experiment experiments experimental evaluation evaluate improved improvement performance towards toward between among during from into over under how what which when where while can could may might will would should more most less least new current recent existing various significant significantly high higher low lower".split(" ")
);
function claimId(text) {
  return createHash7("sha256").update(text).digest("hex").slice(0, 12);
}
function tag(level) {
  return level === "abstract" ? "[A]" : "[M]";
}
function extractThemes(papers, k = 6) {
  const df = /* @__PURE__ */ new Map();
  for (const p of papers) {
    const titleWords = p.title.toLowerCase().match(/[a-z\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]{2,}/g) ?? [];
    const absWords = (p.abstractText ?? "").toLowerCase().match(/[a-z\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]{2,}/g) ?? [];
    const weights = /* @__PURE__ */ new Map();
    for (const w of titleWords) if (!STOPWORDS.has(w) && w.length >= 4) weights.set(w, (weights.get(w) ?? 0) + 3);
    for (const w of absWords) if (!STOPWORDS.has(w) && w.length >= 4) weights.set(w, (weights.get(w) ?? 0) + 1);
    for (const [w, weight] of weights) {
      void weight;
      if (!df.has(w)) df.set(w, /* @__PURE__ */ new Set());
      df.get(w).add(p.id);
    }
  }
  const themes = [...df.entries()].filter(([term]) => term.length >= 4 && df.get(term).size >= Math.max(2, Math.floor(papers.length * 0.05))).sort((a, b) => b[1].size - a[1].size).slice(0, k).map(([label, set]) => ({ label, paperIds: [...set] }));
  return themes;
}
function yearHistogram(papers) {
  const map = /* @__PURE__ */ new Map();
  for (const p of papers) {
    if (p.year === void 0) continue;
    map.set(p.year, (map.get(p.year) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }));
}
function synthesize(collection) {
  const papers = collection.papers;
  const warnings = [];
  const claims = [];
  if (papers.length === 0) {
    return {
      markdown: `# Literature report \u2014 ${collection.topic}

No papers available (${collection.notes ?? "empty corpus"}). Nothing was fabricated.
`,
      claims: [],
      warnings: ["empty collection"]
    };
  }
  const themes = extractThemes(papers);
  for (const t of themes) {
    const validIds = t.paperIds.filter((id) => papers.some((p) => p.id === id));
    claims.push({
      claimId: claimId(`theme:${t.label}`),
      statement: `Theme "${t.label}" appears in ${validIds.length}/${papers.length} collected papers (keyword co-occurrence).`,
      paperIds: validIds,
      evidenceLevel: "metadata"
    });
  }
  for (const p of papers.slice(0, 5)) {
    const level = p.evidenceLevel === "metadata" ? "metadata" : "abstract";
    const tagText = tag(level);
    claims.push({
      claimId: claimId(`rep:${p.id}`),
      statement: `${p.title} (${p.year ?? "n.d."}) is among the most referenced works in this collection${p.citationCount !== void 0 ? ` with ${p.citationCount} tracked citations` : ""}. ${tagText} ${level === "metadata" ? "Metadata-level observation only." : "Abstract supports topical relevance."}`,
      paperIds: [p.id],
      evidenceLevel: level
    });
  }
  const knownIds = new Set(papers.map((p) => p.id));
  const validatedClaims = claims.filter((c) => c.paperIds.every((id) => knownIds.has(id)));
  if (validatedClaims.length < claims.length) {
    warnings.push(`${claims.length - validatedClaims.length} claims dropped by citation validator`);
  }
  const lines = [];
  lines.push(`# Literature report \u2014 ${collection.topic}`);
  lines.push("");
  lines.push(`> Generated deterministically from provider metadata${collection.complete ? "" : " (PARTIAL corpus)"}.`);
  lines.push(`> Evidence tags: **[M]** metadata-only \xB7 **[A]** abstract-supported. No full-text reading occurred in this pipeline.`);
  lines.push("");
  lines.push("## 1. Scope & query");
  lines.push(`- Topic: \`${collection.topic}\``);
  lines.push(`- Requested unique papers: ${collection.requestedCount}; delivered: ${papers.length}`);
  if (collection.notes) lines.push(`- Provider notes: ${collection.notes}`);
  lines.push("");
  lines.push("## 2. Selection method");
  lines.push("- Providers queried (primary discovery: OpenAlex; enrichment: Semantic Scholar where configured)");
  lines.push("- Deduplication on canonical keys: normalized DOI \u2192 OpenAlex ID \u2192 S2 ID \u2192 title+year+first-author fingerprint");
  lines.push("- Ranking: provider relevance, then recency; citation count shown but not used as rank");
  lines.push("");
  lines.push(`## 3. Collected papers (${papers.length})`);
  lines.push("");
  lines.push("| # | Title | Authors | Year | Venue | Cites | OA | Evidence |");
  lines.push("|---|-------|---------|------|-------|-------|----|----------|");
  papers.forEach((p, i) => {
    const authors = p.authors.length > 3 ? `${p.authors.slice(0, 3).join(", ")} et al.` : p.authors.join(", ");
    const ev = p.abstractAvailable ? "[A]" : "[M]";
    lines.push(
      `| ${i + 1} | ${p.title.replace(/\|/g, "\\|")} | ${authors.replace(/\|/g, "\\|")} | ${p.year ?? ""} | ${(p.venue ?? "").replace(/\|/g, "\\|")} | ${p.citationCount ?? ""} | ${p.openAccess === void 0 ? "" : p.openAccess ? "OA" : ""} | ${ev} |`
    );
  });
  lines.push("");
  lines.push("## 4. Major themes (keyword clusters)");
  for (const c of validatedClaims.filter((c2) => c2.statement.startsWith("Theme"))) {
    lines.push(`- ${tag(c.evidenceLevel)} ${c.statement} \`claim:${c.claimId}\``);
  }
  lines.push("");
  lines.push("## 5. Chronological trend");
  const hist = yearHistogram(papers);
  if (hist.length > 0) {
    lines.push("");
    lines.push("| Year | Papers |");
    lines.push("|------|--------|");
    for (const h of hist) lines.push(`| ${h.year} | ${h.count} |`);
  } else {
    lines.push("- No publication years available in metadata.");
  }
  lines.push("");
  lines.push("## 6. Representative works");
  for (const c of validatedClaims.filter((c2) => !c2.statement.startsWith("Theme"))) {
    lines.push(`- ${c.statement} \`claim:${c.claimId}\``);
  }
  lines.push("");
  lines.push("## 7. Methodological patterns & disagreements");
  lines.push(`- [M] This MVP pipeline has NOT read full texts, so it makes no methodological or disagreement claims about individual papers.`);
  lines.push(`- Abstract-grounded pattern extraction is limited to topics present above; treat all theme labels as coarse keyword clusters, not research communities.`);
  lines.push("");
  lines.push("## 8. Research gaps");
  lines.push(`- [M] Honest limitation: gap detection requires full-text evidence (planned local indexing stage). The theme coverage table above is the only defensible signal at this stage.`);
  lines.push("");
  lines.push("## 9. What to read first");
  const shortlist = [...papers].sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0)).slice(0, 3);
  for (const p of shortlist) {
    const doi = p.doi ? ` https://doi.org/${p.doi}` : "";
    lines.push(`1. ${p.title} (${p.year ?? "n.d."}${p.citationCount !== void 0 ? `, ${p.citationCount} cites` : ""}).${doi}`);
  }
  lines.push("");
  lines.push("## 10. Source appendix");
  lines.push("");
  for (const p of papers.slice(0, 50)) {
    const ids = [p.doi ? `doi:${p.doi}` : null, p.openAlexId ? `openalex:${p.openAlexId}` : null, p.s2Id ? `s2:${p.s2Id}` : null].filter(Boolean).join(" \xB7 ");
    lines.push(`- ${p.title} \u2014 ${ids}`);
  }
  return { markdown: lines.join("\n"), claims: validatedClaims, warnings };
}

// src/host/research/index.ts
var ResearchService = class {
  store;
  builder;
  layout;
  artifacts;
  constructor(db, layout, artifacts, extraProviders = []) {
    this.layout = layout;
    this.artifacts = artifacts;
    this.store = new CollectionStore(db);
    const cacheRoot = join4(layout.cacheDir, "academic");
    const providers = [
      new OpenAlexProvider({ cacheDir: join4(cacheRoot, "openalex") }),
      new SemanticScholarProvider({ cacheDir: join4(cacheRoot, "s2") }),
      ...extraProviders
    ];
    this.builder = new CollectionBuilder(this.store, providers);
  }
  latest(input) {
    return this.builder.build({
      topic: input.topic,
      count: input.count,
      since: input.since,
      poolFactor: 3
    });
  }
  get(collectionId) {
    return this.store.get(collectionId);
  }
  list() {
    return this.store.list();
  }
  /** Deterministic cited synthesis → Markdown artifact bound to nothing external. */
  synthesizeToArtifact(collectionId) {
    const collection = this.store.get(collectionId);
    if (!collection) throw new Error(`collection not found: ${collectionId}`);
    const result = synthesize(collection);
    const ref = this.artifacts.put({
      kind: "research-report",
      mediaType: "text/markdown",
      bytes: result.markdown,
      sourceRefs: [
        {
          id: `collection-${collectionId}`,
          kind: "url",
          ref: `grad://collections/${collectionId}`,
          title: `Paper collection "${collection.topic}"`,
          createdAt: collection.createdAt
        }
      ]
    });
    return { artifactId: ref.id, warnings: result.warnings, ...result.claims.length ? { claimCount: result.claims.length } : {} };
  }
};

// src/host/connectors/registry.ts
var ConnectorRegistry = class {
  connectors = /* @__PURE__ */ new Map();
  register(connector) {
    this.connectors.set(connector.id, connector);
    return () => this.connectors.delete(connector.id);
  }
  get(id) {
    return this.connectors.get(id);
  }
  require(id) {
    const connector = this.connectors.get(id);
    if (!connector) throw new Error(`connector not found: ${id}`);
    return connector;
  }
  list() {
    return [...this.connectors.values()].map((c) => ({
      id: c.id,
      label: c.label,
      actions: c.capabilities().actions,
      ...c.capabilities().notes ? { notes: c.capabilities().notes } : {}
    }));
  }
  async healthAll() {
    return Promise.all(
      [...this.connectors.values()].map(async (c) => ({ id: c.id, health: await c.health() }))
    );
  }
};

// src/host/connectors/feishu.ts
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync as writeFileSync3, rmSync as rmSync2 } from "node:fs";
import { tmpdir } from "node:os";
import { join as join5 } from "node:path";
var DEFAULT_TIMEOUT_MS = 3e4;
var processExecutor = (argv, { timeoutMs }) => new Promise((resolve) => {
  const child = spawn(argv[0], argv.slice(1), { windowsHide: true });
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => child.kill(), timeoutMs);
  child.stdout?.on("data", (d) => {
    stdout += String(d);
  });
  child.stderr?.on("data", (d) => {
    stderr += String(d);
  });
  child.on("error", (err) => {
    clearTimeout(timer);
    resolve({ code: -1, stdout, stderr: `${stderr}${err.message}` });
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    resolve({ code: code ?? -1, stdout, stderr });
  });
});
function buildArgv(action, cliPath) {
  switch (action.type) {
    case "doc.create": {
      if (action.markdown.length > 2e3) {
        const dir = mkdtempSync(join5(tmpdir(), "grad-feishu-"));
        const file = join5(dir, "content.md");
        writeFileSync3(file, action.markdown);
        return {
          argv: [cliPath, "doc", "create", "--title", action.title, "--content-file", file],
          cleanup: () => rmSync2(dir, { recursive: true, force: true })
        };
      }
      return { argv: [cliPath, "doc", "create", "--title", action.title, "--content", action.markdown] };
    }
    case "doc.append":
      return { argv: [cliPath, "doc", "append", "--document", action.documentId, "--content", action.markdown] };
    case "im.send":
      return {
        argv: [cliPath, "im", "send", "--receive-id-type", action.receiveIdType, "--receive-id", action.receiveId, "--text", action.text]
      };
    case "base.row-insert": {
      const fields = JSON.stringify(action.fields);
      return { argv: [cliPath, "base", "record", "create", "--app", action.appToken, "--table", action.tableId, "--fields", fields] };
    }
  }
}
function describe(action) {
  switch (action.type) {
    case "doc.create":
      return { summary: `Create Feishu document "${action.title}" (${action.markdown.split("\n").length} lines of Markdown)`, destination: "Feishu Docs" };
    case "doc.append":
      return { summary: `Append ${action.markdown.length} characters to Feishu document ${action.documentId}`, destination: `Feishu doc ${action.documentId}` };
    case "im.send":
      return { summary: `Send message to ${action.receiveIdType} ${action.receiveId}: "${action.text.slice(0, 80)}${action.text.length > 80 ? "\u2026" : ""}"`, destination: `Feishu IM ${action.receiveId}` };
    case "base.row-insert":
      return { summary: `Insert 1 row with ${Object.keys(action.fields).length} fields into table ${action.tableId}`, destination: `Feishu Base ${action.appToken}/${action.tableId}` };
  }
}
var FeishuCliConnector = class {
  id = "feishu";
  label = "Feishu / Lark (official CLI)";
  db;
  opts;
  constructor(db, opts = {}) {
    this.db = db;
    this.opts = opts;
  }
  get cliPath() {
    return this.opts.cliPath ?? process.env.LARK_CLI_PATH ?? "lark";
  }
  capabilities() {
    return {
      actions: ["doc.create", "doc.append", "im.send", "base.row-insert"],
      notes: "Uses the official Lark/Feishu CLI auth store. Publish actions always require explicit approval; the CLI binary must be installed and authenticated."
    };
  }
  async health() {
    const exec = this.opts.executor ?? processExecutor;
    const res = await exec([this.cliPath, "--version"], { timeoutMs: 5e3 });
    if (res.code !== 0) {
      return {
        ok: false,
        reason: "larksuite/cli not found or not runnable. Install it and authenticate with your Feishu account, or set LARK_CLI_PATH."
      };
    }
    return { ok: true };
  }
  async preview(action) {
    const d = describe(action);
    const card = [
      `**Action:** ${d.summary}`,
      "",
      "**Destination:** " + d.destination,
      "",
      action.type === "doc.create" || action.type === "doc.append" ? "```markdown\n" + action.markdown.slice(0, 1200) + "\n```" : `\`\`\`
${JSON.stringify(action, null, 2).slice(0, 800)}
\`\`\``,
      "",
      "_External write: YES \u2014 requires approval._"
    ].join("\n");
    return { summary: d.summary, destination: d.destination, card };
  }
  async execute(action, ctx) {
    if (ctx.approval.payloadHash !== payloadHash(action)) {
      throw errors.approvalInvalid(ctx.approval.id, "payload hash does not match this action");
    }
    if (ctx.approval.status !== "consumed") {
      throw errors.approvalInvalid(
        ctx.approval.id,
        `approval gate not run (status "${ctx.approval.status}") \u2014 consume the approval before executing`
      );
    }
    const d = describe(action);
    const eventId = crypto.randomUUID();
    try {
      this.db.prepare(
        `INSERT INTO connector_events (id, connector_id, action_type, approval_id, summary, created_at)
           VALUES (?, 'feishu', ?, ?, ?, ?)`
      ).run(eventId, action.type, ctx.approval.id, d.summary, (/* @__PURE__ */ new Date()).toISOString());
    } catch {
      throw errors.approvalInvalid(ctx.approval.id, "this approval has already been executed (duplicate publish blocked)");
    }
    try {
      const health = await this.health();
      if (!health.ok) {
        this.finishEvent(eventId, false, void 0, health.reason);
        return { ok: false, error: health.reason };
      }
      const exec = this.opts.executor ?? processExecutor;
      const { argv, cleanup } = buildArgv(action, this.cliPath);
      try {
        const res = await exec(argv, { timeoutMs: this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS });
        if (res.code !== 0) {
          const error = `lark cli exit ${res.code}: ${res.stderr.slice(0, 400) || res.stdout.slice(0, 400)}`;
          this.finishEvent(eventId, false, void 0, error);
          return { ok: false, error };
        }
        const raw = safeParse2(res.stdout);
        const externalRef = extractRef(res.stdout);
        this.finishEvent(eventId, true, externalRef, void 0);
        return { ok: true, ...raw ? { raw } : {}, ...externalRef ? { externalRef } : {} };
      } finally {
        cleanup?.();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.finishEvent(eventId, false, void 0, message);
      throw err;
    }
  }
  finishEvent(eventId, ok, externalRef, error) {
    this.db.prepare("UPDATE connector_events SET ok = ?, external_ref = ?, error = ? WHERE id = ?").run(ok ? 1 : 0, externalRef ?? null, error ?? null, eventId);
  }
};
function safeParse2(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function extractRef(stdout) {
  const urlMatch = stdout.match(/https?:\/\/[^\s"']+/);
  return urlMatch?.[0];
}

// src/host/services/index.ts
function buildServices(layout) {
  const database = openDatabase({ layout });
  const { db } = database;
  const artifacts = new ArtifactStore(db, layout.artifactsDir);
  const approvals = new ApprovalService(db);
  const workflows = new WorkflowEngine(db, approvals, artifacts);
  const captures = new CaptureService(db);
  const memory = new MemoryService(db);
  const communication = new CommunicationService(artifacts, memory);
  const food = new FoodService(db);
  const ledger = new LedgerService(db);
  const forms = new FormService(db);
  const research = new ResearchService(db, layout, artifacts);
  const audio = new AudioBriefService(artifacts);
  const connectors = new ConnectorRegistry();
  connectors.register(new FeishuCliConnector(db));
  const studio = new SkillStudioService({
    database,
    artifacts,
    approvals,
    workflows,
    captures,
    memory,
    communication,
    food,
    ledger,
    forms,
    studio: void 0,
    audio,
    research,
    connectors,
    close: () => {
    }
  });
  return {
    database,
    artifacts,
    approvals,
    workflows,
    captures,
    memory,
    communication,
    food,
    ledger,
    forms,
    studio,
    audio,
    research,
    connectors,
    close() {
      db.close();
    }
  };
}

// src/host/http.ts
var MAX_BODY_BYTES = 64 * 1024;
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("body-too-large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function routeErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err?.code ?? "INTERNAL";
      if (!res.headersSent) json(res, 500, { ok: false, error: code, message });
      else res.end();
    }
  };
}

// src/host/routes/index.ts
var API_PREFIX = "/api/grad";
function makeRoutes(deps) {
  const { services } = deps;
  const exact = (path, handler) => ({
    kind: "exact",
    path,
    handler: routeErrors(handler)
  });
  return [
    exact(`${API_PREFIX}/health`, (req, res) => {
      if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      json(res, 200, {
        ok: true,
        plugin: "dsh-grad-workbench",
        version: deps.version,
        dataDir: deps.layout.root,
        migrations: deps.services.database.appliedMigrations(),
        workflows: services.workflows.listWorkflows(),
        startedAt: deps.startedAt,
        timestamp: Date.now()
      });
    }),
    // ── captures ────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/captures`, async (req, res) => {
      if (req.method === "GET") {
        const url = new URL(req.url ?? "/", "http://localhost");
        const status = url.searchParams.get("status") ?? void 0;
        json(res, 200, { ok: true, captures: services.captures.list({ status }) });
        return;
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (typeof body.text !== "string" || body.text.length === 0) {
          return void json(res, 400, { ok: false, error: "text-required" });
        }
        const capture = services.captures.create({ text: body.text, source: body.source ?? "dsh" });
        json(res, 201, { ok: true, capture });
        return;
      }
      json(res, 405, { ok: false, error: "method-not-allowed" });
    }),
    // ── workflows & runs ─────────────────────────────────────────────────────
    exact(`${API_PREFIX}/workflows`, (_req, res) => {
      json(res, 200, { ok: true, workflows: services.workflows.listWorkflows() });
    }),
    exact(`${API_PREFIX}/runs`, (req, res) => {
      if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      const url = new URL(req.url ?? "/", "http://localhost");
      const status = url.searchParams.get("status") ?? void 0;
      json(res, 200, { ok: true, runs: services.workflows.listRuns({ status }) });
    }),
    {
      kind: "prefix",
      path: `${API_PREFIX}/runs`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
        const runId = pathnameSuffix(req, `${API_PREFIX}/runs/`);
        const run = services.workflows.getRun(runId);
        json(res, 200, {
          ok: true,
          run,
          steps: services.workflows.getSteps(runId),
          approvals: services.approvals.list({ workflowRunId: runId }),
          artifacts: services.artifacts.list({ workflowRunId: runId })
        });
      })
    },
    {
      kind: "prefix",
      path: `${API_PREFIX}/workflows`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== "POST") return void json(res, 405, { ok: false, error: "method-not-allowed" });
        const workflowId = pathnameSuffix(req, `${API_PREFIX}/workflows/`).split("/")[0];
        const body = await readJsonBody(req);
        try {
          const run = await services.workflows.start(workflowId, body.input ?? body);
          json(res, 202, { ok: true, run, steps: services.workflows.getSteps(run.id) });
        } catch (err) {
          const code = err.code;
          const message = err instanceof Error ? err.message : String(err);
          if (code === "NOT_FOUND") json(res, 404, { ok: false, error: message });
          else if (code === "INVALID_INPUT") json(res, 400, { ok: false, error: message });
          else throw err;
        }
      })
    },
    // ── approvals ────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/approvals`, (req, res) => {
      if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      const url = new URL(req.url ?? "/", "http://localhost");
      const status = url.searchParams.get("status") ?? void 0;
      json(res, 200, { ok: true, approvals: services.approvals.list({ status }) });
    }),
    {
      kind: "prefix",
      path: `${API_PREFIX}/approvals`,
      handler: routeErrors(async (req, res) => {
        const suffix = pathnameSuffix(req, `${API_PREFIX}/approvals/`);
        const [approvalId, action] = suffix.split("/");
        if (!approvalId) return void json(res, 400, { ok: false, error: "approval-id-required" });
        if (action === void 0 && req.method === "GET") {
          return void json(res, 200, { ok: true, approval: services.approvals.get(approvalId) });
        }
        if (action === "resolve" && req.method === "POST") {
          const body = await readJsonBody(req);
          if (body.decision !== "approved" && body.decision !== "rejected") {
            return void json(res, 400, { ok: false, error: "decision must be approved|rejected" });
          }
          const approval = services.approvals.resolve(approvalId, body.decision);
          let run = void 0;
          if (approval.workflowRunId) {
            run = await services.workflows.resume(approval.workflowRunId);
          }
          return void json(res, 200, { ok: true, approval, run });
        }
        json(res, 404, { ok: false, error: "not-found" });
      })
    },
    // ── artifacts ────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/artifacts`, (req, res) => {
      if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      json(res, 200, { ok: true, artifacts: services.artifacts.list() });
    }),
    {
      kind: "prefix",
      path: `${API_PREFIX}/artifacts`,
      handler: routeErrors((req, res) => {
        if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
        const id = pathnameSuffix(req, `${API_PREFIX}/artifacts/`).split("/")[0];
        const { meta, text } = services.artifacts.readText(id);
        json(res, 200, { ok: true, artifact: meta, content: text });
      })
    },
    // ── research ─────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/research/collections`, routeErrors(async (req, res) => {
      if (req.method === "GET") {
        return void json(res, 200, { ok: true, collections: services.research.list() });
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (!body.topic) return void json(res, 400, { ok: false, error: "topic-required" });
        const collection = await services.research.latest({
          topic: body.topic,
          count: body.count,
          since: body.since
        });
        return void json(res, 200, {
          ok: true,
          collectionId: collection.id,
          delivered: collection.papers.length,
          requested: collection.requestedCount,
          complete: collection.complete,
          note: collection.notes,
          papers: collection.papers.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors.slice(0, 4),
            year: p.year,
            venue: p.venue,
            citationCount: p.citationCount,
            evidenceLevel: p.evidenceLevel
          }))
        });
      }
      json(res, 405, { ok: false, error: "method-not-allowed" });
    })),
    {
      kind: "prefix",
      path: `${API_PREFIX}/research/collections`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== "GET" && req.method !== "POST") {
          return void json(res, 405, { ok: false, error: "method-not-allowed" });
        }
        const suffix = pathnameSuffix(req, `${API_PREFIX}/research/collections/`);
        const [id, action] = suffix.split("/");
        if (!id) return void json(res, 400, { ok: false, error: "collection-id-required" });
        if (!action && req.method === "GET") {
          const collection = services.research.get(id);
          return void json(res, 200, { ok: true, found: Boolean(collection), ...collection ? { collection } : {} });
        }
        if (action === "synthesize" && req.method === "POST") {
          const result = services.research.synthesizeToArtifact(id);
          return void json(res, 200, { ok: true, ...result });
        }
        json(res, 404, { ok: false, error: "not-found" });
      })
    },
    // ── skills ───────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/skills`, (req, res) => {
      if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      json(res, 200, {
        ok: true,
        skills: services.studio.listSkills(),
        recipes: services.studio.listRecipes()
      });
    }),
    // ── connectors ───────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/connectors`, routeErrors(async (req, res) => {
      if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      const healths = await services.connectors.healthAll();
      const byId = new Map(healths.map((h) => [h.id, h.health]));
      json(res, 200, {
        ok: true,
        connectors: services.connectors.list().map((c) => ({
          ...c,
          healthy: byId.get(c.id)?.ok ?? false,
          reason: byId.get(c.id)?.reason
        }))
      });
    })),
    // ── communication ────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/communication/understand`, routeErrors(async (req, res) => {
      if (req.method !== "POST") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      const body = await readJsonBody(req);
      if (!body.text) return void json(res, 400, { ok: false, error: "text-required" });
      json(res, 200, { ok: true, understanding: services.communication.understand(body.text) });
    })),
    exact(`${API_PREFIX}/communication/draft`, routeErrors(async (req, res) => {
      if (req.method !== "POST") return void json(res, 405, { ok: false, error: "method-not-allowed" });
      const body = await readJsonBody(req);
      if (!body.originalText) return void json(res, 400, { ok: false, error: "originalText-required" });
      const result = services.communication.draft({
        originalText: body.originalText,
        userFacts: body.myUpdate
      });
      const saved = services.communication.saveDraft({
        originalText: body.originalText,
        markdown: result.drafts[0].markdown
      });
      json(res, 200, { ok: true, drafts: result.drafts, contextUsed: result.contextUsed, artifactId: saved.artifactId });
    })),
    // ── food ─────────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/food/restaurants`, routeErrors(async (req, res) => {
      if (req.method === "GET") {
        const url = new URL(req.url ?? "/", "http://localhost");
        return void json(res, 200, {
          ok: true,
          restaurants: services.food.list({
            status: url.searchParams.get("status") ?? void 0,
            query: url.searchParams.get("q") ?? void 0
          })
        });
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (!body.name) return void json(res, 400, { ok: false, error: "name-required" });
        const r = services.food.save(body);
        return void json(res, 201, { ok: true, restaurant: r });
      }
      json(res, 405, { ok: false, error: "method-not-allowed" });
    })),
    {
      kind: "prefix",
      path: `${API_PREFIX}/food/restaurants`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== "POST") return void json(res, 405, { ok: false, error: "method-not-allowed" });
        const suffix = pathnameSuffix(req, `${API_PREFIX}/food/restaurants/`);
        const [id, action] = suffix.split("/");
        if (!id || !action) return void json(res, 400, { ok: false, error: "id-and-action-required" });
        const body = await readJsonBody(req);
        switch (action) {
          case "confirm":
            try {
              return void json(res, 200, { ok: true, restaurant: services.food.confirm(id, body) });
            } catch (err) {
              const code = err.code;
              if (code === "INVALID_INPUT") return void json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
              throw err;
            }
          case "status":
            return void json(res, 200, {
              ok: true,
              restaurant: services.food.setStatus(id, body.status, body.rating)
            });
          case "delete":
            services.food.delete(id);
            return void json(res, 200, { ok: true });
          default:
            json(res, 404, { ok: false, error: "not-found" });
        }
      })
    },
    // ── life ledger ──────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/ledger`, routeErrors(async (req, res) => {
      if (req.method === "GET") {
        const url = new URL(req.url ?? "/", "http://localhost");
        const category = url.searchParams.get("category") ?? void 0;
        if (url.searchParams.get("format") === "csv") {
          const csv = services.ledger.exportCsv(category);
          res.writeHead(200, { "content-type": "text/csv; charset=utf-8" });
          return void res.end(csv);
        }
        return void json(res, 200, {
          ok: true,
          entries: services.ledger.list({ category }),
          summary: services.ledger.summary({ category })
        });
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        try {
          const entry = body.category === "fitness" ? services.ledger.addWorkout(body) : services.ledger.add(body);
          return void json(res, 201, { ok: true, entry });
        } catch (err) {
          const code = err.code;
          if (code === "INVALID_INPUT") {
            return void json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
          }
          throw err;
        }
      }
      json(res, 405, { ok: false, error: "method-not-allowed" });
    })),
    {
      kind: "prefix",
      path: `${API_PREFIX}/ledger/summary`,
      handler: routeErrors((req, res) => {
        if (req.method !== "GET") return void json(res, 405, { ok: false, error: "method-not-allowed" });
        const url = new URL(req.url ?? "/", "http://localhost");
        const category = url.searchParams.get("category") ?? void 0;
        json(res, 200, { ok: true, summary: services.ledger.summary({ category }) });
      })
    },
    // ── memory ───────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/memory`, routeErrors(async (req, res) => {
      if (req.method === "GET") {
        const url = new URL(req.url ?? "/", "http://localhost");
        const q = url.searchParams.get("q");
        if (q) {
          const results = services.memory.search({ query: q, limit: 30, includeOutdated: true });
          return void json(res, 200, {
            ok: true,
            results: results.map((r) => ({ ...r.item, why: r.why, ageDays: r.ageDays }))
          });
        }
        return void json(res, 200, { ok: true, items: services.memory.list({ limit: 100 }) });
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (!body.content) return void json(res, 400, { ok: false, error: "content-required" });
        const item = services.memory.remember({
          content: body.content,
          kind: body.kind,
          sourceType: "user",
          userConfirmed: true
        });
        return void json(res, 201, { ok: true, item });
      }
      json(res, 405, { ok: false, error: "method-not-allowed" });
    })),
    {
      kind: "prefix",
      path: `${API_PREFIX}/memory`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== "POST") return void json(res, 405, { ok: false, error: "method-not-allowed" });
        const suffix = pathnameSuffix(req, `${API_PREFIX}/memory/`);
        const [id, action] = suffix.split("/");
        if (!id || !action) return void json(res, 400, { ok: false, error: "memory-id-and-action-required" });
        switch (action) {
          case "confirm":
            json(res, 200, { ok: true, item: services.memory.confirm(id) });
            break;
          case "pin": {
            const item = services.memory.get(id);
            json(res, 200, { ok: true, item: services.memory.setPinned(id, !(item.pinned ?? false)) });
            break;
          }
          case "delete":
            services.memory.delete(id);
            json(res, 200, { ok: true });
            break;
          default:
            json(res, 404, { ok: false, error: "not-found" });
        }
      })
    }
  ];
}
function pathnameSuffix(req, prefix) {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (!pathname.startsWith(prefix)) return "";
  return decodeURIComponent(pathname.slice(prefix.length));
}

// src/host/tools/define.ts
function compileParameters(spec) {
  const properties = {};
  const required = [];
  for (const [key, node] of Object.entries(spec)) {
    const { required: isRequired, ...rest } = node;
    if (isRequired === true) required.push(key);
    properties[key] = stripAuthorAnnotations(rest);
  }
  return {
    type: "object",
    properties,
    ...required.length > 0 ? { required } : {},
    // Open root: models may add harmless extras; domain validators re-check.
    additionalProperties: true
  };
}
function stripAuthorAnnotations(node) {
  if (typeof node !== "object" || node === null) return node;
  if (Array.isArray(node)) return node.map(stripAuthorAnnotations);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = k === "items" ? stripAuthorAnnotations(v) : k === "properties" && typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, stripAuthorAnnotations(pv)])) : v;
  }
  return out;
}
function toJsonLossless(value) {
  if (value === void 0) return null;
  if (Array.isArray(value)) return value.map((v) => v === void 0 ? null : toJsonLossless(v));
  if (typeof value === "object" && value !== null) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === void 0) continue;
      out[k] = toJsonLossless(v);
    }
    return out;
  }
  return value;
}
function defineGradTool(opts) {
  return {
    name: opts.name,
    description: opts.description,
    parameters: compileParameters(opts.parameters),
    output: {
      schema: opts.outputSchema,
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    execute: async (args, exec) => toJsonLossless(await opts.execute(args, exec))
  };
}
function objectSchema(properties, required) {
  return { type: "object", properties, required, additionalProperties: false };
}

// src/host/tools/foundation.ts
function registerFoundationTools(tools, services) {
  const definitions = [makePingTool(services), ...makeFoundationTools(services)];
  return definitions.map((def) => tools.register(def));
}
var PLUGIN_VERSION = "0.0.0";
function setToolVersion(version) {
  PLUGIN_VERSION = version;
}
function makePingTool(services) {
  return defineGradTool({
    name: "grad_ping",
    description: "Health check for the Graduate OS (dsh-grad-workbench) plugin. Returns plugin version, data directory and registered workflows.",
    parameters: {},
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        plugin: { type: "string" },
        version: { type: "string" },
        dataDir: { type: "string" },
        workflows: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" }, title: { type: "string" } },
            required: ["id"],
            additionalProperties: false
          }
        }
      },
      ["ok", "plugin", "version", "dataDir"]
    ),
    execute() {
      return Promise.resolve({
        ok: true,
        plugin: "dsh-grad-workbench",
        version: PLUGIN_VERSION,
        dataDir: resolveDataDir(),
        workflows: services.workflows.listWorkflows().map((w) => ({ id: w.id, title: w.title }))
      });
    }
  });
}
function makeFoundationTools(services) {
  const capture = defineGradTool({
    name: "grad_capture",
    description: "Capture an item into the Graduate OS universal inbox (text). Deterministic routing assigns an intent like research.literature-radar or communication.advisor-reply when confident.",
    parameters: {
      text: { type: "string", description: "Captured text content", required: true },
      source: {
        type: "string",
        enum: ["dsh", "feishu", "wechat", "file", "browser", "share"],
        description: "Where the capture came from"
      }
    },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        captureId: { type: "string" },
        intent: { type: "string" },
        confidence: { type: "number" },
        status: { type: "string" }
      },
      ["ok", "captureId", "intent", "confidence", "status"]
    ),
    execute(args) {
      const a = args;
      const item = services.captures.create({ text: a.text, source: a.source });
      return Promise.resolve({
        ok: true,
        captureId: item.id,
        intent: item.inferredIntent ?? "inbox.unrouted",
        confidence: item.routeConfidence ?? 0,
        status: item.status
      });
    }
  });
  const runWorkflow = defineGradTool({
    name: "grad_run_workflow",
    description: "Start a registered Graduate OS workflow and wait until it completes or parks waiting for user approval. Registered IDs include echo-demo.",
    parameters: {
      workflowId: { type: "string", description: "Workflow ID, e.g. echo-demo", required: true },
      input: { type: "object", additionalProperties: true, description: "Workflow input payload" }
    },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        runId: { type: "string" },
        status: { type: "string" },
        error: { type: "string" },
        hint: { type: "string" }
      },
      ["ok", "runId", "status"]
    ),
    async execute(args) {
      const a = args;
      const run = await services.workflows.start(a.workflowId, a.input ?? {});
      return {
        ok: true,
        runId: run.id,
        status: run.status,
        ...run.error ? { error: run.error } : {},
        ...run.status === "waiting_approval" ? {
          hint: "Run parked: show the user each pending approval (grad_approval_get), then resolve via grad_approval_resolve on their explicit decision."
        } : {}
      };
    }
  });
  const getRun = defineGradTool({
    name: "grad_get_run",
    description: "Inspect one workflow run: status, steps, approvals and artifacts (full provenance view).",
    parameters: { runId: { type: "string", required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        run: { type: "object", properties: {}, required: [], additionalProperties: true },
        steps: { type: "array", items: { type: "object", properties: {}, required: [], additionalProperties: true } },
        approvals: { type: "array", items: { type: "object", properties: {}, required: [], additionalProperties: true } }
      },
      ["ok", "run"]
    ),
    async execute(args) {
      const runId = args.runId;
      const run = services.workflows.getRun(runId);
      return Promise.resolve({
        ok: true,
        run,
        steps: services.workflows.getSteps(runId),
        approvals: services.approvals.list({ workflowRunId: runId })
      });
    }
  });
  const listRuns = defineGradTool({
    name: "grad_list_runs",
    description: "List recent Graduate OS workflow runs, newest first.",
    parameters: {
      status: {
        type: "string",
        enum: ["queued", "running", "waiting_approval", "failed", "completed"],
        description: "Filter by status"
      },
      limit: { type: "integer", description: "Max rows (default 25)" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, count: { type: "integer" }, runs: { type: "array", items: { type: "string" } } },
      ["ok", "count", "runs"]
    ),
    execute(args) {
      const a = args;
      const runs = services.workflows.listRuns({ status: a.status, limit: a.limit ?? 25 });
      return Promise.resolve({
        ok: true,
        count: runs.length,
        runs: runs.map((r) => `${r.id} (${r.workflowId}, ${r.status})`)
      });
    }
  });
  const approvalGet = defineGradTool({
    name: "grad_approval_get",
    description: "Fetch one approval request (action, summary, payload, destination) so it can be shown to the user before resolving.",
    parameters: { approvalId: { type: "string", required: true } },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, approval: { type: "object", properties: {}, required: [], additionalProperties: true } },
      ["ok", "approval"]
    ),
    execute(args) {
      const approvalId = args.approvalId;
      return Promise.resolve({ ok: true, approval: services.approvals.get(approvalId) });
    }
  });
  const approvalResolve = defineGradTool({
    name: "grad_approval_resolve",
    description: "Resolve an approval request for an external side effect. ALWAYS show the user the summary/preview first; approve or reject strictly on their explicit decision. Approving resumes the parked workflow run.",
    parameters: {
      approvalId: { type: "string", required: true },
      decision: { type: "string", enum: ["approved", "rejected"], required: true }
    },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        approvalStatus: { type: "string" },
        runStatus: { type: "string", description: "Workflow run status after resuming (when bound to a run)" }
      },
      ["ok", "approvalStatus"]
    ),
    async execute(args) {
      const a = args;
      const approval = services.approvals.resolve(a.approvalId, a.decision);
      let runStatus;
      if (approval.workflowRunId) {
        const run = await services.workflows.resume(approval.workflowRunId);
        runStatus = run.status;
      }
      return { ok: true, approvalStatus: approval.status, ...runStatus ? { runStatus } : {} };
    }
  });
  return [capture, runWorkflow, getRun, listRuns, approvalGet, approvalResolve];
}

// src/host/tools/memory.ts
function makeMemoryTools(services) {
  const remember = defineGradTool({
    name: "grad_memory_remember",
    description: 'Store a durable fact/preference/decision in Graduate OS scoped memory after the user EXPLICITLY asked to remember something ("\u8BB0\u4F4F\u2026"/"remember that\u2026"). Written as confirmed with source=user.',
    parameters: {
      content: { type: "string", description: "The fact to store, one self-contained sentence", required: true },
      kind: {
        type: "string",
        enum: ["fact", "preference", "decision", "lesson", "entity", "summary"],
        description: "Memory kind; default fact"
      },
      project: { type: "string", description: "Project name to scope this memory to (optional)" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, memoryId: { type: "string" }, scopeType: { type: "string" }, confirmed: { type: "boolean" } },
      ["ok", "memoryId", "scopeType", "confirmed"]
    ),
    async execute(args) {
      const a = args;
      let projectId;
      if (a.project) projectId = services.memory.ensureProject(a.project);
      const item = services.memory.remember({
        content: a.content,
        kind: a.kind,
        sourceType: "user",
        userConfirmed: true,
        ...a.project ? { scopeType: "project", scopeId: projectId ?? a.project } : {}
      });
      return { ok: true, memoryId: item.id, scopeType: item.scopeType, confirmed: item.userConfirmed };
    }
  });
  const propose = defineGradTool({
    name: "grad_memory_propose",
    description: "Propose a CANDIDATE memory (userConfirmed=0) when you inferred a personal fact/preference but the user did not explicitly ask to remember it. The user confirms or rejects it in the Memory Center.",
    parameters: {
      content: { type: "string", required: true },
      kind: {
        type: "string",
        enum: ["fact", "preference", "decision", "lesson", "entity", "summary"],
        description: "Default preference for inferred personal facts"
      },
      reason: { type: "string", description: "Why you think this is worth remembering (shown to the user)" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, memoryId: { type: "string" }, status: { type: "string" } },
      ["ok", "memoryId", "status"]
    ),
    async execute(args) {
      const a = args;
      const item = services.memory.remember({
        content: a.content,
        kind: a.kind ?? "preference",
        sourceType: "workflow",
        userConfirmed: false,
        confidence: 0.5,
        ...a.reason ? { sourceRef: `proposed:${a.reason.slice(0, 120)}` } : {}
      });
      return { ok: true, memoryId: item.id, status: "candidate-awaiting-user-confirmation" };
    }
  });
  const search = defineGradTool({
    name: "grad_memory_search",
    description: "Search Graduate OS scoped memory before answering personal-context questions. Returns matched items with why-matched, source and age. Restricted items are excluded.",
    parameters: {
      query: { type: "string", required: true },
      project: { type: "string", description: "Restrict to a project scope (global memories still included)" },
      limit: { type: "integer", description: "Max results (default 8)" }
    },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        count: { type: "integer" },
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              content: { type: "string" },
              kind: { type: "string" },
              scopeType: { type: "string" },
              why: { type: "string" },
              ageDays: { type: "integer" },
              sourceType: { type: "string" },
              confirmed: { type: "boolean" }
            },
            required: ["id", "content"],
            additionalProperties: false
          }
        }
      },
      ["ok", "count", "results"]
    ),
    execute(args) {
      const a = args;
      const results = services.memory.search({
        query: a.query,
        limit: a.limit ?? 8,
        ...a.project ? { scopeType: "project", scopeId: a.project } : {}
      });
      return Promise.resolve({
        ok: true,
        count: results.length,
        results: results.map((r) => ({
          id: r.item.id,
          content: r.item.content,
          kind: r.item.kind,
          scopeType: r.item.scopeType,
          why: r.why,
          ageDays: r.ageDays,
          sourceType: r.item.sourceType,
          confirmed: r.item.userConfirmed
        }))
      });
    }
  });
  const confirm = defineGradTool({
    name: "grad_memory_confirm",
    description: "Mark a candidate memory as confirmed by the user (raises confidence, makes it first-class).",
    parameters: { memoryId: { type: "string", required: true } },
    outputSchema: objectSchema({ ok: { type: "boolean" }, confirmed: { type: "boolean" } }, ["ok", "confirmed"]),
    async execute(args) {
      const item = await Promise.resolve(services.memory.confirm(args.memoryId));
      return { ok: true, confirmed: item.userConfirmed };
    }
  });
  const forget = defineGradTool({
    name: "grad_memory_delete",
    description: "Delete a memory item by id after the user asked to remove/correct it. Soft-deleted but removed from search.",
    parameters: { memoryId: { type: "string", required: true } },
    outputSchema: objectSchema({ ok: { type: "boolean" }, deleted: { type: "boolean" } }, ["ok", "deleted"]),
    async execute(args) {
      await Promise.resolve(services.memory.delete(args.memoryId));
      return { ok: true, deleted: true };
    }
  });
  const update = defineGradTool({
    name: "grad_memory_update",
    description: "Correct a memory: stores a NEW item superseding the old one (old stays traceable via supersedes chain), per the non-destructive memory policy.",
    parameters: {
      memoryId: { type: "string", description: "The outdated memory id to supersede", required: true },
      content: { type: "string", description: "The corrected content", required: true }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, newMemoryId: { type: "string" }, supersedes: { type: "string" } },
      ["ok", "newMemoryId", "supersedes"]
    ),
    execute(args) {
      const a = args;
      const old = services.memory.get(a.memoryId);
      const item = services.memory.remember({
        content: a.content,
        kind: old.kind,
        scopeType: old.scopeType,
        scopeId: old.scopeId,
        sensitivity: old.sensitivity,
        sourceType: "user",
        userConfirmed: true,
        supersedesId: old.id
      });
      return Promise.resolve({ ok: true, newMemoryId: item.id, supersedes: old.id });
    }
  });
  const explainRun = defineGradTool({
    name: "grad_memory_explain_run",
    description: 'Answer "which memories were used, why, from where, how old" for a workflow run \u2014 full memory provenance.',
    parameters: { runId: { type: "string", required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        count: { type: "integer" },
        usage: { type: "array", items: { type: "object", properties: {}, required: [], additionalProperties: true } }
      },
      ["ok", "count", "usage"]
    ),
    execute(args) {
      const runId = args.runId;
      const usage = services.memory.explainRun(runId);
      return Promise.resolve({
        ok: true,
        count: usage.length,
        usage: usage.map((u) => ({
          memoryId: u.memory.id,
          content: u.memory.content,
          usedAt: u.usedAt,
          why: u.why,
          sourceType: u.memory.sourceType,
          createdAt: u.memory.createdAt
        }))
      });
    }
  });
  return [remember, propose, search, confirm, update, forget, explainRun];
}

// src/host/tools/research.ts
function makeResearchTools(services) {
  const latest = defineGradTool({
    name: "grad_research_latest",
    description: "Collect the LATEST unique papers on a topic from academic providers (OpenAlex primary; Semantic Scholar enrichment). Deduplicates DOI/OpenAlex/S2 identities, ranks by relevance then recency, and stores a collection. Rate-limited providers yield honest partial results \u2014 the response says so.",
    parameters: {
      topic: { type: "string", description: 'Research topic, e.g. "LLM agent memory"', required: true },
      count: { type: "integer", description: "Unique papers wanted (default 50, max 200)" },
      since: { type: "string", description: 'Only papers from this year or date, e.g. "2025" or "2025-06-01"' }
    },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        collectionId: { type: "string" },
        delivered: { type: "integer" },
        requested: { type: "integer" },
        complete: { type: "boolean" },
        note: { type: "string" },
        topTitles: { type: "array", items: { type: "string" }, description: "First few collected titles" }
      },
      ["ok", "collectionId", "delivered", "requested", "complete"]
    ),
    async execute(args) {
      const a = args;
      try {
        const collection = await services.research.latest({
          topic: a.topic,
          count: Math.min(a.count ?? 50, 200),
          since: a.since
        });
        return {
          ok: true,
          collectionId: collection.id,
          delivered: collection.papers.length,
          requested: collection.requestedCount,
          complete: collection.complete,
          ...collection.notes ? { note: collection.notes } : {},
          topTitles: collection.papers.slice(0, 5).map((p) => p.title)
        };
      } catch (err) {
        if (isGradError(err) && !err.retryable) throw err;
        throw err;
      }
    }
  });
  const getCollection = defineGradTool({
    name: "grad_research_get_collection",
    description: "Fetch one stored paper collection with full paper rows (titles, authors, years, venues, evidence levels).",
    parameters: { collectionId: { type: "string", required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        found: { type: "boolean" },
        collection: { type: "object", properties: {}, required: [], additionalProperties: true }
      },
      ["ok", "found"]
    ),
    execute(args) {
      const collectionId = args.collectionId;
      const collection = services.research.get(collectionId);
      return Promise.resolve({ ok: true, found: Boolean(collection), ...collection ? { collection } : {} });
    }
  });
  const synthesize2 = defineGradTool({
    name: "grad_research_synthesize",
    description: "Generate the deterministic cited Markdown report for a stored collection (evidence-tagged claims, theme clusters, year trend, reading shortlist). Local artifact only; publishing externally requires an approval flow.",
    parameters: { collectionId: { type: "string", required: true } },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, artifactId: { type: "string" }, claimCount: { type: "integer" }, warnings: { type: "array", items: { type: "string" } } },
      ["ok", "artifactId"]
    ),
    async execute(args) {
      const collectionId = args.collectionId;
      const result = await Promise.resolve(services.research.synthesizeToArtifact(collectionId));
      return {
        ok: true,
        artifactId: result.artifactId,
        warnings: result.warnings,
        ...result.claimCount !== void 0 ? { claimCount: result.claimCount } : {}
      };
    }
  });
  return [latest, getCollection, synthesize2];
}

// src/host/tools/connectors.ts
function makeConnectorTools(services) {
  const list = defineGradTool({
    name: "grad_connector_list",
    description: "List configured external connectors (Feishu/Lark first), their supported actions, health and setup hints.",
    parameters: {},
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        connectors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              healthy: { type: "boolean" },
              reason: { type: "string" },
              actions: { type: "array", items: { type: "string" } }
            },
            required: ["id", "label"],
            additionalProperties: false
          }
        }
      },
      ["ok", "connectors"]
    ),
    async execute() {
      const healths = await services.connectors.healthAll();
      const byId = new Map(healths.map((h) => [h.id, h.health]));
      return {
        ok: true,
        connectors: services.connectors.list().map((c) => ({
          id: c.id,
          label: c.label,
          actions: c.actions,
          healthy: byId.get(c.id)?.ok ?? false,
          ...byId.get(c.id)?.reason ? { reason: byId.get(c.id).reason } : {}
        }))
      };
    }
  });
  const preview = defineGradTool({
    name: "grad_feishu_preview",
    description: "Render a human-readable preview card for a Feishu publish action WITHOUT any state change. Always show this to the user before preparing an approval.",
    parameters: {
      actionType: {
        type: "string",
        enum: ["doc.create", "doc.append", "im.send", "base.row-insert"],
        description: "Which Feishu action to preview",
        required: true
      },
      title: { type: "string", description: "doc.create: document title" },
      markdown: { type: "string", description: "doc.create/doc.append: Markdown content" },
      documentId: { type: "string", description: "doc.append: target doc id" },
      receiveIdType: { type: "string", enum: ["open_id", "chat_id"], description: "im.send" },
      receiveId: { type: "string", description: "im.send: target user/chat id" },
      text: { type: "string", description: "im.send: message text" },
      appToken: { type: "string", description: "base.row-insert: Base app token" },
      tableId: { type: "string", description: "base.row-insert: table id" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, summary: { type: "string" }, destination: { type: "string" }, card: { type: "string" } },
      ["ok", "summary", "destination", "card"]
    ),
    async execute(args) {
      const action = actionFromArgs(args);
      const preview2 = await services.connectors.require("feishu").preview(action);
      return { ok: true, summary: preview2.summary, destination: preview2.destination, card: preview2.card };
    }
  });
  const prepare = defineGradTool({
    name: "grad_feishu_prepare_publish",
    description: "Create a PENDING approval request for a Feishu publish action. Show the user the preview and let them decide; nothing is sent until grad_feishu_execute_publish runs after an explicit approval.",
    parameters: {
      actionType: {
        type: "string",
        enum: ["doc.create", "doc.append", "im.send", "base.row-insert"],
        required: true
      },
      title: { type: "string" },
      markdown: { type: "string" },
      documentId: { type: "string" },
      receiveIdType: { type: "string", enum: ["open_id", "chat_id"] },
      receiveId: { type: "string" },
      text: { type: "string" },
      appToken: { type: "string" },
      tableId: { type: "string" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, approvalId: { type: "string" }, status: { type: "string" }, hint: { type: "string" } },
      ["ok", "approvalId", "status"]
    ),
    async execute(args) {
      const action = actionFromArgs(args);
      const connectorPreview = await services.connectors.require("feishu").preview(action);
      const approval = services.approvals.create({
        actionType: `feishu.${action.type}`,
        summary: connectorPreview.summary,
        payload: action,
        destination: connectorPreview.destination
      });
      return {
        ok: true,
        approvalId: approval.id,
        status: approval.status,
        hint: "Show the preview card to the user. After they explicitly approve, resolve via grad_approval_resolve then run grad_feishu_execute_publish."
      };
    }
  });
  const executePublish = defineGradTool({
    name: "grad_feishu_execute_publish",
    description: "Execute an APPROVED Feishu publish. Requires the approval to be already resolved as approved (consumed here); refuses mutated payloads, re-used approvals and duplicate publishes durably.",
    parameters: { approvalId: { type: "string", required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        published: { type: "boolean" },
        externalRef: { type: "string" },
        error: { type: "string" }
      },
      ["ok", "published"]
    ),
    async execute(args) {
      const approvalId = args.approvalId;
      const approval = services.approvals.get(approvalId);
      const action = approval.payload;
      const consumed = services.approvals.consume(approvalId, action);
      try {
        const result = await services.connectors.require("feishu").execute(action, { approval: { ...consumed, payloadHash: payloadHash(action) } });
        return {
          ok: result.ok,
          published: result.ok,
          ...result.externalRef ? { externalRef: result.externalRef } : {},
          ...result.error ? { error: result.error } : {}
        };
      } catch (err) {
        if (isGradError(err)) return { ok: false, published: false, error: err.message };
        throw err;
      }
    }
  });
  function actionFromArgs(args) {
    const a = args;
    switch (a.actionType ?? a.type) {
      case "doc.create": {
        if (typeof a.title !== "string" || typeof a.markdown !== "string") {
          throw Object.assign(new Error("doc.create requires title and markdown"), { code: "INVALID_INPUT" });
        }
        return { type: "doc.create", title: a.title, markdown: a.markdown };
      }
      case "doc.append":
        return { type: "doc.append", documentId: String(a.documentId), markdown: String(a.markdown ?? "") };
      case "im.send":
        return {
          type: "im.send",
          receiveIdType: a.receiveIdType === "chat_id" ? "chat_id" : "open_id",
          receiveId: String(a.receiveId),
          text: String(a.text ?? "")
        };
      case "base.row-insert":
        return {
          type: "base.row-insert",
          appToken: String(a.appToken),
          tableId: String(a.tableId),
          fields: a.fields ?? {}
        };
      default:
        throw Object.assign(new Error(`unknown feishu action type: ${String(a.actionType)}`), { code: "INVALID_INPUT" });
    }
  }
  return [list, preview, prepare, executePublish];
}

// src/host/tools/communication.ts
function makeCommunicationTools(services) {
  const understand = defineGradTool({
    name: "grad_comm_understand",
    description: "Analyze an advisor/teacher message: relationship, scenario, intent, risk, key points and explicit commitments/deadlines. Deterministic keyword analysis \u2014 present as hints to the user, not facts.",
    parameters: { text: { type: "string", description: "The received message text", required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        relationship: { type: "string" },
        scenario: { type: "string" },
        intent: { type: "string" },
        risk: { type: "string" },
        coreDemand: { type: "string" },
        keyPoints: { type: "array", items: { type: "string" } },
        commitments: {
          type: "array",
          items: {
            type: "object",
            properties: { what: { type: "string" }, due: { type: "string" } },
            required: ["what"],
            additionalProperties: false
          }
        }
      },
      ["ok", "relationship", "scenario", "intent", "risk", "coreDemand"]
    ),
    execute(args) {
      const text = args.text;
      return Promise.resolve({ ok: true, ...services.communication.understand(text) });
    }
  });
  const draft = defineGradTool({
    name: "grad_comm_draft_reply",
    description: "Draft replies to an advisor/teacher message in multiple tones. NEVER invents progress: substantive claims come only from myUpdate text the user supplied; missing parts render explicit fill-in placeholders. Drafts are not sent.",
    parameters: {
      originalText: { type: "string", description: "The received message being replied to", required: true },
      myUpdate: { type: "string", description: "Facts from the user about actual progress/plans (the only source of substance)" }
    },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        drafts: {
          type: "array",
          items: {
            type: "object",
            properties: { tone: { type: "string" }, markdown: { type: "string" } },
            required: ["tone", "markdown"],
            additionalProperties: false
          }
        },
        contextUsed: {
          type: "array",
          items: { type: "object", properties: { content: { type: "string" }, why: { type: "string" } }, required: ["content"], additionalProperties: false },
          description: "Memory items consulted while drafting (with provenance)"
        },
        savedArtifactId: { type: "string" }
      },
      ["ok", "drafts"]
    ),
    async execute(args) {
      const a = args;
      const result = services.communication.draft({
        originalText: a.originalText,
        userFacts: a.myUpdate
      });
      const chosen = result.drafts[0];
      const saved = services.communication.saveDraft({ originalText: a.originalText, markdown: chosen.markdown });
      return Promise.resolve({
        ok: true,
        drafts: result.drafts.map((d) => ({ tone: d.tone, markdown: d.markdown })),
        contextUsed: result.contextUsed,
        savedArtifactId: saved.artifactId
      });
    }
  });
  return [understand, draft];
}

// src/host/tools/food.ts
var restaurantSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    status: { type: "string" },
    address: { type: "string" },
    cuisines: { type: "array", items: { type: "string" } },
    notes: { type: "string" }
  },
  required: ["id", "name", "status"],
  additionalProperties: false
};
function makeFoodTools(services) {
  const save = defineGradTool({
    name: "grad_food_save",
    description: "Save a restaurant candidate (from a screenshot, post or conversation). Saved as UNRESOLVED \u2014 it only becomes a map pin after the user confirms the place. Never auto-confirm an ambiguous location.",
    parameters: {
      name: { type: "string", required: true },
      note: { type: "string", description: "Why it is interesting / who recommended it" },
      cuisine: { type: "string", description: "Cuisine tag, e.g. \u70E4\u8089 / sushi" },
      sourceText: { type: "string", description: "Original text the restaurant was extracted from" },
      city: { type: "string" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, restaurantId: { type: "string" }, status: { type: "string" } },
      ["ok", "restaurantId", "status"]
    ),
    execute(args) {
      const a = args;
      const r = services.food.save(a);
      return Promise.resolve({ ok: true, restaurantId: r.id, status: r.status });
    }
  });
  const confirm = defineGradTool({
    name: "grad_food_confirm",
    description: "Turn an unresolved restaurant into a confirmed pin using USER-PROVIDED place info (address or coordinates). Requires explicit user choice among candidates.",
    parameters: {
      restaurantId: { type: "string", required: true },
      address: { type: "string", description: "User-confirmed address" },
      lat: { type: "number" },
      lng: { type: "number" },
      city: { type: "string" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, restaurantId: { type: "string" }, status: { type: "string" }, address: { type: "string" } },
      ["ok", "restaurantId", "status"]
    ),
    async execute(args) {
      const a = args;
      const r = await Promise.resolve(services.food.confirm(a.restaurantId, a));
      return { ok: true, restaurantId: r.id, status: r.status, ...r.address ? { address: r.address } : {} };
    }
  });
  const list = defineGradTool({
    name: "grad_food_list",
    description: "List saved restaurants, optionally filtered by status (want_to_try/visited/favorite/avoid/unresolved) or a text query over names/tags.",
    parameters: {
      status: {
        type: "string",
        enum: ["want_to_try", "visited", "favorite", "avoid", "unresolved"],
        description: "Filter by pin status"
      },
      query: { type: "string", description: "Text filter over name/tags/cuisines" },
      limit: { type: "integer" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, count: { type: "integer" }, restaurants: { type: "array", items: restaurantSchema } },
      ["ok", "count", "restaurants"]
    ),
    execute(args) {
      const a = args;
      const list2 = services.food.list({ status: a.status, query: a.query, limit: a.limit ?? 50 });
      return Promise.resolve({
        ok: true,
        count: list2.length,
        restaurants: list2.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          ...r.address ? { address: r.address } : {},
          ...r.cuisines.length ? { cuisines: r.cuisines } : {},
          ...r.notes ? { notes: r.notes } : {}
        }))
      });
    }
  });
  const updateStatus = defineGradTool({
    name: "grad_food_update_status",
    description: "Update a restaurant's user status (visited/favorite/want_to_try/avoid) with an optional personal rating 1-5.",
    parameters: {
      restaurantId: { type: "string", required: true },
      status: { type: "string", enum: ["want_to_try", "visited", "favorite", "avoid"], required: true },
      rating: { type: "integer", description: "Personal rating 1-5" }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, restaurantId: { type: "string" }, status: { type: "string" } },
      ["ok", "restaurantId", "status"]
    ),
    async execute(args) {
      const a = args;
      const r = await Promise.resolve(services.food.setStatus(a.restaurantId, a.status, a.rating));
      return { ok: true, restaurantId: r.id, status: r.status };
    }
  });
  return [save, confirm, list, updateStatus];
}

// src/host/tools/ledger.ts
function makeLedgerTools(services) {
  const add = defineGradTool({
    name: "grad_ledger_add",
    description: "Add a life-ledger event (volunteer hours, reading session, research session\u2026). Duration comes from start/end or explicit minutes. Fitness workouts should use grad_workout_log instead.",
    parameters: {
      category: {
        type: "string",
        enum: ["volunteer", "reading", "research", "custom"],
        description: "Event category (fitness goes through grad_workout_log)",
        required: true
      },
      startAt: { type: "string", description: "ISO timestamp, e.g. 2026-03-08T09:00:00+08:00", required: true },
      endAt: { type: "string", description: "Optional end timestamp; duration computed in UTC" },
      durationMinutes: { type: "integer" },
      organization: { type: "string", description: "Volunteer org / club name" },
      activityType: { type: "string", description: "What kind of activity" },
      note: { type: "string" }
    },
    outputSchema: objectSchema({ ok: { type: "boolean" }, entryId: { type: "string" }, durationMinutes: { type: "integer" } }, [
      "ok",
      "entryId"
    ]),
    async execute(args) {
      const a = args;
      if (!a.startAt) throw Object.assign(new Error("startAt is required"), { code: "INVALID_INPUT" });
      const entry = await Promise.resolve(
        services.ledger.add({
          category: a.category,
          startAt: a.startAt,
          ...a.endAt !== void 0 ? { endAt: a.endAt } : {},
          ...a.durationMinutes !== void 0 ? { durationMinutes: a.durationMinutes } : {},
          ...a.organization ? { organization: a.organization } : {},
          ...a.activityType ? { activityType: a.activityType } : {},
          ...a.note ? { note: a.note } : {}
        })
      );
      return { ok: true, entryId: entry.id, ...entry.durationMinutes !== void 0 ? { durationMinutes: entry.durationMinutes } : {} };
    }
  });
  const workout = defineGradTool({
    name: "grad_workout_log",
    description: "Log a workout session with exercises (sets/reps/weight/minutes). Enables the 'last time' comparison via grad_workout_last.",
    parameters: {
      startAt: { type: "string", description: "ISO timestamp of the session start", required: true },
      endAt: { type: "string" },
      note: { type: "string" },
      exercises: {
        type: "array",
        description: "At least one exercise",
        required: true,
        items: {
          type: "object",
          properties: {
            exercise: { type: "string" },
            sets: { type: "integer" },
            reps: { type: "integer" },
            weightKg: { type: "number" },
            durationMinutes: { type: "integer" }
          },
          required: ["exercise"],
          additionalProperties: false
        }
      }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, entryId: { type: "string" }, exerciseCount: { type: "integer" } },
      ["ok", "entryId", "exerciseCount"]
    ),
    async execute(args) {
      const a = args;
      const entry = await Promise.resolve(services.ledger.addWorkout(a));
      return { ok: true, entryId: entry.id, exerciseCount: entry.sets?.length ?? 0 };
    }
  });
  const summary = defineGradTool({
    name: "grad_ledger_summary",
    description: "Aggregate ledger totals (minutes/hours) per month and organization, optionally filtered by category/year.",
    parameters: {
      category: { type: "string", enum: ["volunteer", "fitness", "research", "reading", "custom"] },
      year: { type: "integer" }
    },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        totalHours: { type: "number" },
        count: { type: "integer" },
        byMonth: { type: "object", properties: {}, required: [], additionalProperties: true },
        byOrganization: { type: "object", properties: {}, required: [], additionalProperties: true }
      },
      ["ok", "totalHours", "count"]
    ),
    execute(args) {
      const a = args;
      const s = services.ledger.summary({ category: a.category, year: a.year });
      return Promise.resolve({
        ok: true,
        totalHours: Math.round(s.totalMinutes / 60 * 10) / 10,
        count: s.count,
        byMonth: s.byMonth,
        byOrganization: s.byOrganization
      });
    }
  });
  const lastWorkout = defineGradTool({
    name: "grad_workout_last",
    description: "Show the most recent logged workout with its exercises \u2014 the 'what did I do last time' lookup.",
    parameters: {},
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, found: { type: "boolean" }, workout: { type: "object", properties: {}, required: [], additionalProperties: true } },
      ["ok", "found"]
    ),
    execute() {
      const w = services.ledger.lastWorkout();
      return Promise.resolve({ ok: true, found: Boolean(w), ...w ? { workout: w } : {} });
    }
  });
  return [add, workout, summary, lastWorkout];
}

// src/host/tools/form.ts
function makeFormTools(services) {
  const inspect = defineGradTool({
    name: "grad_form_inspect",
    description: "Inspect a form URL: field schema, proposed values WITH their source (profile vault / user input needed), and whether a saved recipe matches. Sensitive vault fields are never auto-proposed. Returns a planId used by the fill/submit gates.",
    parameters: { url: { type: "string", description: "Form URL", required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        planId: { type: "string" },
        recipeMatched: { type: "boolean" },
        proposals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "string" },
              source: { type: "string" },
              needsUserInput: { type: "boolean" }
            },
            required: ["label", "source"],
            additionalProperties: false
          }
        }
      },
      ["ok", "planId", "proposals"]
    ),
    async execute(args) {
      const url = args.url;
      const result = await services.forms.inspectAndPropose(url);
      return {
        ok: true,
        planId: result.planId,
        recipeMatched: result.recipeMatched,
        proposals: result.proposals
      };
    }
  });
  const saveProfileField = defineGradTool({
    name: "grad_form_save_profile_field",
    description: "Save one reusable personal form field into the local profile vault (e.g. \u5B66\u53F7/\u8054\u7CFB\u7535\u8BDD). Sensitive fields must be marked sensitive \u2014 they are never auto-filled.",
    parameters: {
      fieldKey: { type: "string", required: true },
      label: { type: "string", required: true },
      value: { type: "string", required: true },
      sensitivity: { type: "string", enum: ["normal", "private", "restricted"] }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, fieldKey: { type: "string" }, sensitivity: { type: "string" } },
      ["ok", "fieldKey", "sensitivity"]
    ),
    execute(args) {
      const a = args;
      const f = services.forms.saveProfileField(a);
      return Promise.resolve({ ok: true, fieldKey: f.fieldKey, sensitivity: f.sensitivity });
    }
  });
  function gatedExecution(args, run) {
    const approval = services.approvals.get(args.approvalId);
    const actionPayload = { planId: args.planId };
    if (approval.payload?.planId !== args.planId) {
      throw Object.assign(new Error("approval is bound to a different form plan"), { code: "APPROVAL_INVALID" });
    }
    const consumed = services.approvals.consume(args.approvalId, actionPayload);
    return Promise.resolve(run(args.planId, { ...consumed, payloadHash: payloadHash(actionPayload) }, actionPayload));
  }
  const fill = defineGradTool({
    name: "grad_form_fill",
    description: "FILL gate: after the user approved the form.fill request, consume that approval and fill the form with the proposed values. Submitting requires a SEPARATE later approval.",
    parameters: {
      planId: { type: "string", required: true },
      approvalId: { type: "string", description: "The approved form.fill approval id", required: true }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, filledFields: { type: "array", items: { type: "string" } }, error: { type: "string" } },
      ["ok"]
    ),
    async execute(args) {
      const a = args;
      const result = await gatedExecution(
        a,
        (planId, approval, payload) => services.forms.executeFill(planId, approval, payload)
      );
      return result;
    }
  });
  const submit = defineGradTool({
    name: "grad_form_submit",
    description: "SUBMIT gate: after a SECOND explicit user approval of form.submit, submit the filled form. Refuses to run before fill completed.",
    parameters: {
      planId: { type: "string", required: true },
      approvalId: { type: "string", description: "The approved form.submit approval id", required: true }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, confirmationRef: { type: "string" }, error: { type: "string" } },
      ["ok"]
    ),
    async execute(args) {
      const a = args;
      const result = await gatedExecution(
        a,
        (planId, approval, payload) => services.forms.executeSubmit(planId, approval, payload)
      );
      if (result.ok) {
      }
      return result;
    }
  });
  return [inspect, saveProfileField, fill, submit];
}

// src/host/tools/skill-studio.ts
function makeSkillStudioTools(services) {
  const list = defineGradTool({
    name: "grad_skill_list",
    description: "List atomic skills available to Skill Studio with their input/output contracts and whether they perform external side effects.",
    parameters: {},
    outputSchema: objectSchema(
      {
        ok: { type: "boolean" },
        skills: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              requiredInputs: { type: "array", items: { type: "string" } },
              outputs: { type: "array", items: { type: "string" } },
              externalSideEffect: { type: "boolean" }
            },
            required: ["id", "title"],
            additionalProperties: false
          }
        },
        recipes: {
          type: "array",
          items: { type: "object", properties: { recipeId: { type: "string" }, title: { type: "string" } }, required: ["recipeId", "title"], additionalProperties: false }
        }
      },
      ["ok", "skills", "recipes"]
    ),
    execute() {
      return Promise.resolve({
        ok: true,
        skills: services.studio.listSkills().map((m) => ({
          id: m.id,
          title: m.title,
          requiredInputs: m.requiredInputs,
          outputs: m.outputs,
          externalSideEffect: m.externalSideEffect
        })),
        recipes: services.studio.listRecipes()
      });
    }
  });
  const compose = defineGradTool({
    name: "grad_skill_compose_recipe",
    description: "Compose and validate a recipe from 2+ atomic skills (linear chain). Side-effect skills automatically gain an approval gate. Returns a runnable workflow id; run it via grad_run_workflow.",
    parameters: {
      title: { type: "string", required: true },
      steps: {
        type: "array",
        description: 'Ordered skill ids, e.g. ["academic-retrieval","literature-synthesis"]',
        items: { type: "object", properties: { skillId: { type: "string" }, staticInput: { type: "object", properties: {}, required: [], additionalProperties: true } }, required: ["skillId"], additionalProperties: false },
        required: true
      }
    },
    outputSchema: objectSchema(
      { ok: { type: "boolean" }, recipeId: { type: "string" }, warnings: { type: "array", items: { type: "string" } }, hint: { type: "string" } },
      ["ok", "recipeId"]
    ),
    async execute(args) {
      const a = args;
      try {
        const result = services.studio.compose({ title: a.title, steps: a.steps });
        return {
          ok: true,
          ...result,
          hint: `Run it with grad_run_workflow workflowId="${result.recipeId}".`
        };
      } catch (err) {
        if (isGradError(err)) throw err;
        throw err;
      }
    }
  });
  return [list, compose];
}

// src/host/workflows.ts
var ECHO_DEMO_WORKFLOW = {
  id: "echo-demo",
  version: "0.1.0",
  title: "Echo Demo \u2014 foundation proof workflow",
  description: 'Normalizes a message into an artifact, then "publishes" it behind an approval gate. Used by tests and as the reference for real vertical slices.',
  validateInput(input) {
    if (typeof input !== "object" || input === null || typeof input.message !== "string") {
      throw errors.invalidInput("echo-demo requires input { message: string }");
    }
    return input;
  },
  steps: [
    {
      name: "normalize",
      skillId: "echo-normalize",
      execute(input) {
        const message = input.message;
        return { normalized: message.trim(), length: message.trim().length };
      }
    },
    {
      name: "publish-echo",
      skillId: "echo-publish",
      requiresApprovals(input) {
        return [
          {
            actionType: "demo.external_write",
            summary: "Write echo report artifact (demo external-write stand-in)",
            payload: input,
            destination: "local artifact store"
          }
        ];
      },
      async execute(input, ctx) {
        ctx.recordToolCall("artifact.write_markdown", true);
        const artifact = ctx.artifacts.put({
          kind: "generic",
          mediaType: "text/markdown",
          bytes: `# Echo Report

- message: ${input.normalized}
- run: ${ctx.runId}
- step: ${ctx.stepId}
`,
          workflowRunId: ctx.runId
        });
        return { artifactId: artifact.id };
      }
    }
  ]
};
function makeLiteratureToFeishuWorkflow(services) {
  const radar = makeLiteratureRadarWorkflow(services);
  return {
    id: "literature-to-feishu",
    version: "0.1.0",
    title: "Latest papers \u2192 cited report \u2192 Feishu publish (approved)",
    description: "Runs the research radar, then publishes the cited Markdown report as a new Feishu document \u2014 ONLY after the user approves the publish preview.",
    validateInput(input) {
      if (typeof input !== "object" || input === null || typeof input.topic !== "string") {
        throw errors.invalidInput("literature-to-feishu requires input { topic: string, count?: number, since?: string }");
      }
      return input;
    },
    steps: [
      radar.steps[0],
      // build-collection
      radar.steps[1],
      // synthesize-report
      {
        name: "publish-to-feishu",
        skillId: "feishu-publish",
        requiresApprovals(input) {
          const action = buildPublishAction(services, input);
          return [
            {
              actionType: "feishu.publish",
              summary: `Publish "${action.title}" to Feishu Docs`,
              payload: action,
              destination: "Feishu Docs"
            }
          ];
        },
        async execute(input, ctx) {
          ctx.recordToolCall("feishu.publish", true);
          const action = buildPublishAction(services, input);
          const approvals = services.approvals.list({ workflowRunId: ctx.runId });
          const mine = approvals.find((a) => a.stepId === ctx.stepId && a.status === "consumed");
          if (!mine) throw errors.approvalRequired("feishu.publish");
          const result = await services.connectors.require("feishu").execute(action, { approval: mine });
          if (!result.ok) return { published: false, error: result.error };
          return { published: true, externalRef: result.externalRef };
        }
      }
    ]
  };
}
function buildPublishAction(services, input) {
  const reportArtifactId = input.reportArtifactId;
  if (!reportArtifactId) throw errors.workflowState("unknown", "synthesize-report", "publish");
  const { text } = services.artifacts.readText(reportArtifactId);
  return {
    type: "doc.create",
    title: `Literature report \u2014 collection ${reportArtifactId.slice(0, 8)}`,
    markdown: text
  };
}
function makeLiteratureRadarWorkflow(services) {
  return {
    id: "literature-radar",
    version: "0.1.0",
    title: "Latest Literature Radar \u2192 cited Markdown report",
    description: "Queries academic providers for recent papers on a topic, dedupes canonical identities, ranks, and renders a deterministic evidence-tagged Markdown report. Produces local artifacts only \u2014 external publishing is a separate approved step.",
    validateInput(input) {
      if (typeof input !== "object" || input === null || typeof input.topic !== "string") {
        throw errors.invalidInput("literature-radar requires input { topic: string, count?: number, since?: string }");
      }
      return input;
    },
    steps: [
      {
        name: "build-collection",
        skillId: "academic-retrieval",
        async execute(input, ctx) {
          const a = input;
          ctx.recordToolCall("academic.search", true);
          const collection = await services.research.latest({ topic: a.topic, count: a.count ?? 50, since: a.since });
          return {
            collectionId: collection.id,
            delivered: collection.papers.length,
            requested: collection.requestedCount,
            complete: collection.complete,
            note: collection.notes
          };
        }
      },
      {
        name: "synthesize-report",
        skillId: "literature-synthesis",
        execute(input, ctx) {
          const collectionId = input.collectionId;
          if (!collectionId) throw errors.workflowState("unknown", "build-collection", "synthesize");
          ctx.recordToolCall("artifact.write_markdown", true);
          const result = services.research.synthesizeToArtifact(collectionId);
          return { reportArtifactId: result.artifactId, warnings: result.warnings };
        }
      }
    ]
  };
}

// src/host/index.ts
var PACKAGE_JSON = fileURLToPath(new URL("../package.json", import.meta.url));
var VERSION = JSON.parse(readFileSync3(PACKAGE_JSON, "utf8")).version ?? "0.0.0";
var inject = ["webServer", "tools"];
function optional(getter) {
  try {
    return getter();
  } catch {
    return void 0;
  }
}
function apply(ctx) {
  setToolVersion(VERSION);
  ctx.effect(() => {
    const layout = dataLayout(resolveDataDir());
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    const services = buildServices(layout);
    const unregisterWorkflows = [
      services.workflows.register(ECHO_DEMO_WORKFLOW),
      services.workflows.register(makeLiteratureRadarWorkflow(services)),
      services.workflows.register(makeLiteratureToFeishuWorkflow(services))
    ];
    const disposers = [];
    const webServer = optional(() => ctx.webServer);
    if (webServer) {
      disposers.push(
        ...makeRoutes({ version: VERSION, layout, services, startedAt }).map((route) => webServer.register(route))
      );
    }
    disposers.push(
      ...registerFoundationTools(ctx.tools, services),
      ...makeMemoryTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeResearchTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeConnectorTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeCommunicationTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeFoodTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeLedgerTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeFormTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeSkillStudioTools(services).map((tool) => ctx.tools.register(tool))
    );
    ctx.logger.info(
      "[dsh-grad-workbench] mounted v%s (data: %s, http: %s)",
      VERSION,
      layout.root,
      webServer ? "yes" : "no"
    );
    return () => {
      services.studio.disposeAll();
      for (const dispose of [...disposers, ...unregisterWorkflows]) dispose();
      services.close();
    };
  }, "dsh-grad-workbench: host");
}
var INTERNAL_API_PREFIX = "/api/grad";
export {
  INTERNAL_API_PREFIX,
  apply,
  inject
};
//# sourceMappingURL=index.js.map
