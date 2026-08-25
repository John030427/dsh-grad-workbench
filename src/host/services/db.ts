/**
 * SQLite (node:sqlite) access with ordered migrations.
 * Canonical local state lives here; the search index is rebuildable.
 */

import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import type { DataLayout } from '../env.ts'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** Ordered schema migrations. Append-only: never edit an applied migration. */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'core-foundation',
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
`,
  },
  {
    version: 2,
    name: 'memory-fts',
    sql: `
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(memory_id UNINDEXED, content);
`,
  },
]

export interface OpenDatabaseOptions {
  layout: DataLayout
  /** When false, opening a database whose migrations are ahead fails loudly. */
  allowNew?: boolean
}

export interface GradDatabase {
  db: DatabaseSync
  appliedMigrations(): Array<{ version: number; name: string }>
}

export function openDatabase(opts: OpenDatabaseOptions): GradDatabase {
  const { layout } = opts
  if (opts.allowNew !== false) {
    mkdirSync(layout.root, { recursive: true })
  }
  const db = new DatabaseSync(layout.dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  const appliedRows = db.prepare('SELECT version FROM _migrations ORDER BY version').all() as Array<{ version: number }>
  const appliedVersions = new Set(appliedRows.map((r) => r.version))

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue
    const run = () => {
      db.exec('BEGIN IMMEDIATE')
      return {
        commit: () => db.exec('COMMIT'),
        rollback: () => db.exec('ROLLBACK'),
      }
    }
    const tx = run()
    try {
      db.exec(migration.sql)
      db.prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      )
      tx.commit()
    } catch (err) {
      tx.rollback()
      throw new Error(
        `migration ${migration.version} (${migration.name}) failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return {
    db,
    appliedMigrations() {
      return db.prepare('SELECT version, name FROM _migrations ORDER BY version').all() as Array<{
        version: number
        name: string
      }>
    },
  }
}
