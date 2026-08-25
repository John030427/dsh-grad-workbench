import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dataDir = mkdtempSync(join(tmpdir(), 'grad-wb-db-'))
process.env.GRAD_WORKBENCH_HOME = dataDir

const host = await import('../../lib/index.js')

function mockCtx(record) {
  return {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    effect(setup) {
      setup()
    },
    webServer: { register: (route) => { record.routes.push(route); return () => {} } },
    skills: { register: () => () => {} },
    tools: { register: (t) => { record.tools.push(t); return () => {} } },
  }
}

test('database schema is created on first mount and persists across mounts', async () => {
  const record = { tools: [], routes: [] }
  host.apply(mockCtx(record))

  const dbPath = join(dataDir, 'grad.db')
  assert.ok(existsSync(dbPath), 'grad.db created in data root')

  const probe = new DatabaseSync(dbPath)
  const tables = probe
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name)
  for (const expected of [
    '_migrations',
    'capture_items',
    'artifacts',
    'workflow_runs',
    'workflow_steps',
    'approval_requests',
    'memory_items',
    'memory_usage',
    'projects',
    'source_refs',
  ]) {
    assert.ok(tables.includes(expected), `table ${expected} exists`)
  }
  const applied = probe.prepare('SELECT version FROM _migrations ORDER BY version').all().map((r) => r.version)
  assert.deepEqual(applied, [1, 2, 3])
  probe.close()

  // Second mount must not fail or duplicate migrations.
  host.apply(mockCtx(record))
  const probe2 = new DatabaseSync(dbPath)
  const applied2 = probe2.prepare('SELECT version FROM _migrations ORDER BY version').all().map((r) => r.version)
  assert.deepEqual(applied2, [1, 2, 3], 'migrations are idempotent across remounts')
  probe2.close()
})

test.after?.(() => {
  try { rmSync(dataDir, { recursive: true, force: true }) } catch {}
})
