/**
 * Life Ledger — one generic timestamped event substrate (volunteer, fitness,
 * research, reading, custom). Domain UIs are projections over this table.
 *
 * Duration rule: `durationMinutes` is computed from start/end when absent and
 * is ALWAYS UTC arithmetic on ISO timestamps, so day/timezone boundaries cannot
 * corrupt totals (tested).
 */

import type { DatabaseSync } from 'node:sqlite'
import { errors } from '../../shared/errors.ts'

export type LedgerCategory = 'volunteer' | 'fitness' | 'research' | 'reading' | 'custom'

export interface WorkoutExerciseInput {
  exercise: string
  sets?: number
  reps?: number
  weightKg?: number
  durationMinutes?: number
  notes?: string
}

export interface LedgerEntryView {
  id: string
  category: LedgerCategory
  startAt: string
  endAt?: string
  durationMinutes?: number
  organization?: string
  activityType?: string
  note?: string
  evidenceRefs: string[]
  source: string
  verification: string
  sets?: Array<{ id: string; exercise: string; sets?: number; reps?: number; weightKg?: number; durationMinutes?: number }>
}

interface Row extends Record<string, unknown> {
  id: string
  category: string
  start_at: string
  end_at: string | null
  duration_minutes: number | null
  organization: string | null
  activity_type: string | null
  note: string | null
  evidence_refs: string
  source: string
  verification: string
}

function toIso(value: unknown, field: string): string {
  const t = typeof value === 'number' ? new Date(value) : new Date(String(value))
  if (Number.isNaN(t.getTime())) throw errors.invalidInput(`${field} is not a valid date`)
  return t.toISOString()
}

export class LedgerService {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  add(input: {
    category: LedgerCategory
    startAt: unknown
    endAt?: unknown
    durationMinutes?: number
    organization?: string
    activityType?: string
    note?: string
    evidenceRefs?: string[]
  }): LedgerEntryView {
    if (!input.category) throw errors.invalidInput('category is required')
    const startAt = toIso(input.startAt, 'startAt')
    let durationMinutes = input.durationMinutes
    let endAt: string | undefined
    if (input.endAt !== undefined && input.endAt !== null) {
      endAt = toIso(input.endAt, 'endAt')
      const diffMin = Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000)
      if (diffMin < 0) throw errors.invalidInput('endAt is before startAt')
      durationMinutes = durationMinutes ?? diffMin
    }
    if (durationMinutes === undefined && !['fitness'].includes(input.category)) {
      // Volunteer/reading/etc. entries need a measurable duration unless a range was given.
      throw errors.invalidInput('provide durationMinutes or an endAt so hours can be counted')
    }

    const id = crypto.randomUUID()
    this.db
      .prepare(
        `INSERT INTO ledger_entries
           (id, category, start_at, end_at, duration_minutes, organization, activity_type, note, evidence_refs, source, verification, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'self', ?)`,
      )
      .run(
        id,
        input.category,
        startAt,
        endAt ?? null,
        durationMinutes ?? null,
        input.organization ?? null,
        input.activityType ?? null,
        input.note ?? null,
        JSON.stringify(input.evidenceRefs ?? []),
        new Date().toISOString(),
      )
    return this.get(id)
  }

  /** One workout session: ledger entry + linked exercise set rows. */
  addWorkout(input: {
    startAt: unknown
    endAt?: unknown
    durationMinutes?: number
    note?: string
    exercises: WorkoutExerciseInput[]
  }): LedgerEntryView {
    if (!Array.isArray(input.exercises) || input.exercises.length === 0) {
      throw errors.invalidInput('a workout needs at least one exercise')
    }
    const entry = this.add({
      category: 'fitness',
      startAt: input.startAt,
      endAt: input.endAt,
      durationMinutes:
        input.durationMinutes ??
        input.exercises.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0),
      activityType: 'workout',
      note: input.note,
    })
    for (const ex of input.exercises) {
      this.db
        .prepare(
          `INSERT INTO fitness_sets (id, ledger_entry_id, exercise, sets, reps, weight_kg, duration_minutes, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          entry.id,
          ex.exercise,
          ex.sets ?? null,
          ex.reps ?? null,
          ex.weightKg ?? null,
          ex.durationMinutes ?? null,
          ex.notes ?? null,
        )
    }
    return this.get(entry.id)
  }

  /** Most recent workout with its exercises — the "last time" comparison. */
  lastWorkout(): LedgerEntryView | undefined {
    const row = this.db
      .prepare("SELECT * FROM ledger_entries WHERE category = 'fitness' AND deleted_at IS NULL ORDER BY start_at DESC LIMIT 1")
      .get() as Row | undefined
    return row ? this.get(row.id) : undefined
  }

  get(id: string): LedgerEntryView {
    const row = this.db.prepare('SELECT * FROM ledger_entries WHERE id = ? AND deleted_at IS NULL').get(id) as
      | Row
      | undefined
    if (!row) throw errors.notFound('ledger entry', id)
    const sets = this.db
      .prepare('SELECT id, exercise, sets, reps, weight_kg, duration_minutes FROM fitness_sets WHERE ledger_entry_id = ?')
      .all(id) as Array<Record<string, unknown>>
    return {
      id: row.id,
      category: row.category as LedgerCategory,
      startAt: row.start_at,
      endAt: row.end_at ?? undefined,
      durationMinutes: row.duration_minutes ?? undefined,
      organization: row.organization ?? undefined,
      activityType: row.activity_type ?? undefined,
      note: row.note ?? undefined,
      evidenceRefs: JSON.parse(row.evidence_refs ?? '[]'),
      source: row.source,
      verification: row.verification,
      ...(sets.length > 0
        ? {
            sets: sets.map((s) => ({
              id: s.id as string,
              exercise: s.exercise as string,
              sets: (s.sets as number) ?? undefined,
              reps: (s.reps as number) ?? undefined,
              weightKg: (s.weight_kg as number) ?? undefined,
              durationMinutes: (s.duration_minutes as number) ?? undefined,
            })),
          }
        : {}),
    }
  }

  list(filter: { category?: LedgerCategory; since?: string; until?: string; limit?: number } = {}): LedgerEntryView[] {
    const clauses = ['deleted_at IS NULL']
    const params: Array<string | number> = []
    if (filter.category) {
      clauses.push('category = ?')
      params.push(filter.category)
    }
    if (filter.since) {
      clauses.push('start_at >= ?')
      params.push(filter.since)
    }
    if (filter.until) {
      clauses.push('start_at < ?')
      params.push(filter.until)
    }
    params.push(filter.limit ?? 100)
    const rows = this.db
      .prepare(`SELECT * FROM ledger_entries WHERE ${clauses.join(' AND ')} ORDER BY start_at DESC LIMIT ?`)
      .all(...params) as unknown as Row[]
    return rows.map((r) => this.get(r.id))
  }

  /** Totals grouped per month and organization/category. */
  summary(filter: { category?: LedgerCategory; year?: number } = {}): {
    totalMinutes: number
    byMonth: Record<string, number>
    byOrganization: Record<string, number>
    count: number
  } {
    const clauses = ['deleted_at IS NULL']
    const params: Array<string | number> = []
    if (filter.category) {
      clauses.push('category = ?')
      params.push(filter.category)
    }
    if (filter.year) {
      clauses.push("start_at LIKE ?")
      params.push(`${filter.year}-%`)
    }
    const rows = this.db
      .prepare(`SELECT * FROM ledger_entries WHERE ${clauses.join(' AND ')}`)
      .all(...params) as unknown as Row[]

    let totalMinutes = 0
    const byMonth: Record<string, number> = {}
    const byOrganization: Record<string, number> = {}
    for (const r of rows) {
      const minutes = (r.duration_minutes as number) ?? 0
      totalMinutes += minutes
      const month = String(r.start_at).slice(0, 7)
      byMonth[month] = (byMonth[month] ?? 0) + minutes
      if (r.organization) {
        byOrganization[r.organization as string] = (byOrganization[r.organization as string] ?? 0) + minutes
      }
    }
    return { totalMinutes, byMonth, byOrganization, count: rows.length }
  }

  delete(id: string): void {
    this.get(id)
    this.db.prepare('UPDATE ledger_entries SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  }

  exportCsv(category?: LedgerCategory): string {
    const rows = this.list({ category, limit: 10_000 })
    const header = 'id,category,startAt,endAt,durationMinutes,organization,activityType,note,evidenceRefs'
    const lines = rows.map((r) =>
      [
        r.id,
        r.category,
        r.startAt,
        r.endAt ?? '',
        String(r.durationMinutes ?? ''),
        r.organization ?? '',
        r.activityType ?? '',
        (r.note ?? '').replace(/"/g, "'"),
        `"${r.evidenceRefs.join(';')}"`,
      ].join(','),
    )
    return [header, ...lines].join('\n')
  }
}
