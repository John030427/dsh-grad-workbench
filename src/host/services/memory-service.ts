/**
 * MemoryService — scoped, inspectable, source-attributed local memory.
 *
 * Guarantees (PRD §6.2 / plan §10):
 *  - canonical rows in SQLite; FTS5 index is rebuildable and never authoritative;
 *  - retrieval answers "which memories, why matched, from where, how old";
 *  - candidate writes start userConfirmed=0; explicit user commands write confirmed;
 *  - changes SUPERSEDE (new item references old), never destructive mutation;
 *  - restricted items are excluded from search unless explicitly requested;
 *  - every workflow consumption is recorded into memory_usage with a reason.
 */

import type { DatabaseSync } from 'node:sqlite'
import type { MemoryItem, MemoryKind, MemoryScopeType, Sensitivity } from '../../shared/contracts.ts'
import { errors } from '../../shared/errors.ts'

export interface RememberInput {
  scopeType?: MemoryScopeType
  scopeId?: string
  kind?: MemoryKind
  content: string
  sourceType?: MemoryItem['sourceType']
  sourceRef?: string
  sensitivity?: Sensitivity
  supersedesId?: string
  userConfirmed: boolean
  confidence?: number
}

export interface ScoredMemory {
  item: MemoryItem
  score: number
  why: string
  ageDays: number
}

interface Row extends Record<string, unknown> {
  id: string
  scope_type: string
  scope_id: string | null
  kind: string
  content: string
  source_type: string
  source_ref: string | null
  confidence: number
  created_at: string
  valid_from: string | null
  valid_to: string | null
  supersedes_id: string | null
  sensitivity: string
  user_confirmed: number
  pinned: number
  outdated: number
  deleted_at: string | null
}

export class MemoryService {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  // ── writes ────────────────────────────────────────────────────────────────

  remember(input: RememberInput): MemoryItem {
    if (!input.content || input.content.trim().length === 0) {
      throw errors.invalidInput('memory content must be a non-empty string')
    }
    // Supersede: new row points at the old one; old becomes outdated (traceable).
    let superseded: MemoryItem | undefined
    if (input.supersedesId) {
      superseded = this.get(input.supersedesId)
      this.db.prepare('UPDATE memory_items SET outdated = 1 WHERE id = ?').run(superseded.id)
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const scopeType = input.scopeType ?? 'global'
    if (scopeType !== 'global' && !input.scopeId) {
      throw errors.invalidInput(`scope "${scopeType}" requires a scopeId`)
    }
    this.db
      .prepare(
        `INSERT INTO memory_items
           (id, scope_type, scope_id, kind, content, source_type, source_ref, confidence,
            created_at, supersedes_id, sensitivity, user_confirmed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        scopeType,
        input.scopeId ?? null,
        input.kind ?? 'fact',
        input.content.trim(),
        input.sourceType ?? 'workflow',
        input.sourceRef ?? null,
        input.confidence ?? (input.userConfirmed ? 0.95 : 0.6),
        now,
        superseded?.id ?? null,
        input.sensitivity ?? 'normal',
        input.userConfirmed ? 1 : 0,
      )
    const item = this.get(id)
    this.index(item)
    return item
  }

  confirm(id: string): MemoryItem {
    this.get(id)
    this.db.prepare('UPDATE memory_items SET user_confirmed = 1, confidence = MAX(confidence, 0.9) WHERE id = ?').run(id)
    return this.get(id)
  }

  setPinned(id: string, pinned: boolean): MemoryItem {
    this.get(id)
    this.db.prepare('UPDATE memory_items SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id)
    return this.get(id)
  }

  /** Soft delete; FTS entry removed. Canonical trace stays until hard purge. */
  delete(id: string): void {
    this.get(id)
    this.db.prepare('UPDATE memory_items SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
    this.db.prepare('DELETE FROM memory_fts WHERE memory_id = ?').run(id)
  }

  /** Rebuild the FTS index from canonical rows (corruption recovery path). */
  rebuildIndex(): number {
    this.db.exec('DELETE FROM memory_fts')
    const rows = this.db
      .prepare('SELECT id, content FROM memory_items WHERE deleted_at IS NULL')
      .all() as Array<{ id: string; content: string }>
    for (const row of rows) {
      this.db.prepare('INSERT INTO memory_fts (memory_id, content) VALUES (?, ?)').run(row.id, row.content)
    }
    return rows.length
  }

  // ── reads ─────────────────────────────────────────────────────────────────

  get(id: string): MemoryItem {
    const row = this.db.prepare('SELECT * FROM memory_items WHERE id = ? AND deleted_at IS NULL').get(id) as
      | Row
      | undefined
    if (!row) throw errors.notFound('memory item', id)
    return this.rowToItem(row)
  }

  list(filter: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; limit?: number } = {}): MemoryItem[] {
    const clauses = ['deleted_at IS NULL']
    const params: Array<string | number> = []
    if (filter.scopeType) {
      clauses.push('scope_type = ?')
      params.push(filter.scopeType)
    }
    if (filter.scopeId) {
      clauses.push('scope_id = ?')
      params.push(filter.scopeId)
    }
    if (filter.kind) {
      clauses.push('kind = ?')
      params.push(filter.kind)
    }
    params.push(filter.limit ?? 100)
    const rows = this.db
      .prepare(`SELECT * FROM memory_items WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`)
      .all(...params) as unknown as Row[]
    return rows.map((r) => this.rowToItem(r))
  }

  /**
   * Hybrid retrieval: lexical FTS + recency decay + pinned boost.
   * Returns WHY each item matched plus provenance metadata.
   */
  search(opts: {
    query: string
    scopeType?: MemoryScopeType
    scopeId?: string
    kinds?: MemoryKind[]
    includeRestricted?: boolean
    includeOutdated?: boolean
    limit?: number
  }): ScoredMemory[] {
    const limit = opts.limit ?? 10
    const now = Date.now()

    // Candidate set: FTS matches (lexical) UNION recent confirmed items.
    const candidates = new Map<string, { item: MemoryItem; lexical: number }>()

    try {
      const ftsRows = this.db
        .prepare(
          `SELECT memory_id, bm25(memory_fts) AS rank FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?`,
        )
        .all(this.sanitizeMatch(opts.query), Math.max(limit * 4, 40)) as Array<{ memory_id: string; rank: number }>
      for (const row of ftsRows) {
        const item = this.safeGet(row.memory_id)
        if (item) candidates.set(item.id, { item, lexical: 1 / (1 + Math.abs(row.rank)) })
      }
    } catch {
      // malformed MATCH expression → fall back to LIKE scan below
    }

    // CJK fallback: the default FTS tokenizer does not segment Chinese, so
    // substring LIKE scans complement MATCH for non-ASCII tokens.
    const cjkTokens = opts.query.split(/\s+/).filter((t) => /[\u4e00-\u9fff]/.test(t) && t.length >= 2)
    if (cjkTokens.length > 0) {
      const clauses = cjkTokens.map(() => 'content LIKE ?').join(' OR ')
      const params = cjkTokens.map((t) => `%${t}%`)
      const likeRows = this.db
        .prepare(`SELECT id FROM memory_items WHERE deleted_at IS NULL AND (${clauses}) LIMIT ?`)
        .all(...params, Math.max(limit * 2, 20)) as Array<{ id: string }>
      for (const row of likeRows) {
        if (!candidates.has(row.id)) {
          const item = this.safeGet(row.id)
          if (item) candidates.set(item.id, { item, lexical: 0.5 })
        }
      }
    }

    for (const item of this.list({ scopeType: opts.scopeType, scopeId: opts.scopeId, limit: 60 })) {
      if (!candidates.has(item.id)) candidates.set(item.id, { item, lexical: 0 })
    }

    const scored: ScoredMemory[] = []
    for (const { item, lexical } of candidates.values()) {
      if (item.sensitivity === 'restricted' && opts.includeRestricted !== true) continue
      if (item.outdated && opts.includeOutdated !== true) continue
      if (opts.kinds && !opts.kinds.includes(item.kind)) continue
      if (opts.scopeType && item.scopeType !== 'global' && item.scopeType !== opts.scopeType) continue
      if (opts.scopeId && item.scopeId && item.scopeId !== opts.scopeId && item.scopeType !== 'global') continue

      const ageDays = Math.max(0, (now - Date.parse(item.createdAt)) / 86_400_000)
      const pinned = (item.pinned ? 0.5 : 0) + (item.userConfirmed ? 0.15 : 0)
      const score = lexical * 2 + pinned
      if (lexical === 0) continue // search is lexical-first: no pure-recency noise

      const whyParts: string[] = []
      if (lexical > 0) whyParts.push(`FTS match on "${opts.query}"`)
      if (item.pinned) whyParts.push('pinned')
      if (ageDays < 7) whyParts.push('recent')
      if (item.userConfirmed) whyParts.push('user-confirmed')
      scored.push({
        item,
        score,
        why: whyParts.length > 0 ? whyParts.join(', ') : 'recency fallback',
        ageDays: Math.round(ageDays),
      })
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /** Provenance for one run: which memories were used, why, from where, how old. */
  explainRun(runId: string): Array<{ memory: MemoryItem; usedAt: string; why: string }> {
    const usages = this.db
      .prepare('SELECT * FROM memory_usage WHERE workflow_run_id = ? ORDER BY used_at')
      .all(runId) as Array<Record<string, unknown>>
    return usages.flatMap((u) => {
      try {
        const item = this.get(u.memory_id as string)
        return [{ memory: item, usedAt: u.used_at as string, why: u.why as string }]
      } catch {
        return [] // deleted since use — usage log remains truthful
      }
    })
  }

  recordUsage(memoryIds: string[], runId: string, stepId: string | undefined, why: string): void {
    const now = new Date().toISOString()
    for (const id of [...new Set(memoryIds)]) {
      // Only record usage for items that still exist (get throws otherwise).
      this.get(id)
      this.db
        .prepare('INSERT INTO memory_usage (id, memory_id, workflow_run_id, step_id, used_at, why) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), id, runId, stepId ?? null, now, why)
    }
  }

  // ── projects ──────────────────────────────────────────────────────────────

  /** Find-or-create a project by name; returns its id (scopeId for project memory). */
  ensureProject(name: string): string {
    const existing = this.db.prepare('SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL').get(name) as
      | { id: string }
      | undefined
    if (existing) return existing.id
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    this.db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, name, now, now)
    return id
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private index(item: MemoryItem): void {
    this.db.prepare('DELETE FROM memory_fts WHERE memory_id = ?').run(item.id)
    this.db.prepare('INSERT INTO memory_fts (memory_id, content) VALUES (?, ?)').run(item.id, item.content)
  }

  private safeGet(id: string): MemoryItem | undefined {
    try {
      return this.get(id)
    } catch {
      return undefined
    }
  }

  private sanitizeMatch(query: string): string {
    // Token-level OR matching: each token quoted (literal), ranked by bm25 so
    // items hitting more tokens surface first.
    const tokens = query.split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 0)
    if (tokens.length === 0) return '""'
    return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ')
  }

  private rowToItem(row: Row): MemoryItem {
    return {
      id: row.id,
      scopeType: row.scope_type as MemoryScopeType,
      scopeId: row.scope_id ?? undefined,
      kind: row.kind as MemoryKind,
      content: row.content,
      sourceType: row.source_type as MemoryItem['sourceType'],
      sourceRef: row.source_ref ?? undefined,
      confidence: row.confidence,
      createdAt: row.created_at,
      validFrom: row.valid_from ?? undefined,
      validTo: row.valid_to ?? undefined,
      supersedesId: row.supersedes_id ?? undefined,
      sensitivity: row.sensitivity as Sensitivity,
      userConfirmed: row.user_confirmed === 1,
      pinned: row.pinned === 1,
      outdated: row.outdated === 1,
    }
  }
}
