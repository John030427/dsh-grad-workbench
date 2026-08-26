/**
 * ArtifactStore — filesystem artifacts + SQLite index.
 * Every generated artifact has a stable ID, SHA-256, producing run and source refs.
 * File names are always server-generated (never trust uploaded names for paths).
 */

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { ArtifactKind, ArtifactRef, SourceRef } from '../../shared/contracts.ts'
import { errors } from '../../shared/errors.ts'

const KIND_DIRS: Record<ArtifactKind, string> = {
  'research-report': 'research',
  'paper-table': 'research',
  'audio-script': 'audio',
  'audio-file': 'audio',
  'communication-draft': 'communication',
  'form-recipe': 'forms',
  'export-csv': 'exports',
  'import': 'imports',
  'generic': 'misc',
}

const EXTENSIONS: Record<string, string> = {
  'text/markdown': '.md',
  'text/plain': '.txt',
  'application/json': '.json',
  'text/csv': '.csv',
  'audio/mpeg': '.mp3',
  'image/png': '.png',
}

export interface PutArtifactInput {
  kind: ArtifactKind
  mediaType: string
  bytes: string | Uint8Array
  workflowRunId?: string
  sourceRefs?: SourceRef[]
  createdAt?: string
}

export class ArtifactStore {
  private readonly db: DatabaseSync
  private readonly artifactsRoot: string

  constructor(db: DatabaseSync, artifactsRoot: string) {
    this.db = db
    this.artifactsRoot = artifactsRoot
  }

  put(input: PutArtifactInput): ArtifactRef {
    const id = crypto.randomUUID()
    const dir = join(this.artifactsRoot, KIND_DIRS[input.kind] ?? 'misc')
    mkdirSync(dir, { recursive: true })
    const ext = EXTENSIONS[input.mediaType] ?? '.bin'
    const path = join(dir, `${id}${ext}`)
    const bytes = typeof input.bytes === 'string' ? Buffer.from(input.bytes, 'utf8') : Buffer.from(input.bytes)
    writeFileSync(path, bytes)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const createdAt = input.createdAt ?? new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO artifacts (id, kind, media_type, path, sha256, size_bytes, created_at, workflow_run_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.kind, input.mediaType, path, sha256, bytes.length, createdAt, input.workflowRunId ?? null)

    for (const ref of input.sourceRefs ?? []) {
      this.db
        .prepare('INSERT OR IGNORE INTO source_refs (id, kind, ref, title, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(ref.id, ref.kind, ref.ref, ref.title ?? null, ref.createdAt)
      this.db
        .prepare('INSERT OR IGNORE INTO artifact_source_refs (artifact_id, source_ref_id) VALUES (?, ?)')
        .run(id, ref.id)
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
      sourceRefs: input.sourceRefs ?? [],
    }
  }

  getMeta(id: string): ArtifactRef {
    const row = this.db
      .prepare(
        `SELECT id, kind, media_type, path, sha256, size_bytes, created_at, workflow_run_id, deleted_at
         FROM artifacts WHERE id = ?`,
      )
      .get(id) as
      | { id: string; kind: string; media_type: string; path: string; sha256: string; size_bytes: number; created_at: string; workflow_run_id: string | null; deleted_at: string | null }
      | undefined
    if (!row || row.deleted_at) throw errors.notFound('artifact', id)
    return {
      id: row.id,
      kind: row.kind as ArtifactKind,
      mediaType: row.media_type,
      path: row.path,
      sha256: row.sha256,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      workflowRunId: row.workflow_run_id ?? undefined,
      sourceRefs: [],
    }
  }

  readText(id: string): { meta: ArtifactRef; text: string } {
    const meta = this.getMeta(id)
    if (!meta.mediaType.startsWith('text/') && meta.mediaType !== 'application/json') {
      throw errors.invalidInput(`artifact ${id} is not textual (${meta.mediaType})`)
    }
    return { meta, text: readFileSync(meta.path, 'utf8') }
  }

  list(filter: { kind?: ArtifactKind; workflowRunId?: string; limit?: number } = {}): ArtifactRef[] {
    const clauses: string[] = ['deleted_at IS NULL']
    const params: Array<string | number> = []
    if (filter.kind) {
      clauses.push('kind = ?')
      params.push(filter.kind)
    }
    if (filter.workflowRunId) {
      clauses.push('workflow_run_id = ?')
      params.push(filter.workflowRunId)
    }
    params.push(filter.limit ?? 50)
    const rows = this.db
      .prepare(`SELECT id FROM artifacts WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`)
      .all(...params) as Array<{ id: string }>
    return rows.map((r) => this.getMeta(r.id))
  }

  delete(id: string): void {
    const meta = this.getMeta(id) // throws when missing
    try {
      rmSync(meta.path, { force: true })
    } catch {
      // file already gone — index cleanup still applies
    }
    this.db.prepare('UPDATE artifacts SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  }
}
