/** Life Ledger tools: volunteer hours, workouts, summaries, last-time context. */

import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

const entrySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    category: { type: 'string' },
    startAt: { type: 'string' },
    durationMinutes: { type: 'integer' },
    organization: { type: 'string' },
    activityType: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['id', 'category', 'startAt'],
  additionalProperties: false,
}

export function makeLedgerTools(services: HostServices): ToolDefinition[] {
  const add = defineGradTool({
    name: 'grad_ledger_add',
    description:
      'Add a life-ledger event (volunteer hours, reading session, research session…). Duration comes from start/end or explicit minutes. Fitness workouts should use grad_workout_log instead.',
    parameters: {
      category: {
        type: 'string',
        enum: ['volunteer', 'reading', 'research', 'custom'],
        description: 'Event category (fitness goes through grad_workout_log)',
        required: true,
      },
      startAt: { type: 'string', description: 'ISO timestamp, e.g. 2026-03-08T09:00:00+08:00', required: true },
      endAt: { type: 'string', description: 'Optional end timestamp; duration computed in UTC' },
      durationMinutes: { type: 'integer' },
      organization: { type: 'string', description: 'Volunteer org / club name' },
      activityType: { type: 'string', description: 'What kind of activity' },
      note: { type: 'string' },
    },
    outputSchema: objectSchema({ ok: { type: 'boolean' }, entryId: { type: 'string' }, durationMinutes: { type: 'integer' } }, [
      'ok',
      'entryId',
    ]),
    async execute(args) {
      const a = args as { category: string; startAt?: unknown; endAt?: unknown; durationMinutes?: number; organization?: string; activityType?: string; note?: string }
      if (!a.startAt) throw Object.assign(new Error('startAt is required'), { code: 'INVALID_INPUT' })
      const entry = await Promise.resolve(
        services.ledger.add({
          category: a.category as never,
          startAt: a.startAt,
          ...(a.endAt !== undefined ? { endAt: a.endAt } : {}),
          ...(a.durationMinutes !== undefined ? { durationMinutes: a.durationMinutes } : {}),
          ...(a.organization ? { organization: a.organization } : {}),
          ...(a.activityType ? { activityType: a.activityType } : {}),
          ...(a.note ? { note: a.note } : {}),
        }),
      )
      return { ok: true, entryId: entry.id, ...(entry.durationMinutes !== undefined ? { durationMinutes: entry.durationMinutes } : {}) }
    },
  })

  const workout = defineGradTool({
    name: 'grad_workout_log',
    description:
      "Log a workout session with exercises (sets/reps/weight/minutes). Enables the 'last time' comparison via grad_workout_last.",
    parameters: {
      startAt: { type: 'string', description: 'ISO timestamp of the session start', required: true },
      endAt: { type: 'string' },
      note: { type: 'string' },
      exercises: {
        type: 'array',
        description: 'At least one exercise',
        required: true,
        items: {
          type: 'object',
          properties: {
            exercise: { type: 'string' },
            sets: { type: 'integer' },
            reps: { type: 'integer' },
            weightKg: { type: 'number' },
            durationMinutes: { type: 'integer' },
          },
          required: ['exercise'],
          additionalProperties: false,
        },
      },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, entryId: { type: 'string' }, exerciseCount: { type: 'integer' } },
      ['ok', 'entryId', 'exerciseCount'],
    ),
    async execute(args) {
      const a = args as unknown as Parameters<typeof services.ledger.addWorkout>[0]
      const entry = await Promise.resolve(services.ledger.addWorkout(a))
      return { ok: true, entryId: entry.id, exerciseCount: entry.sets?.length ?? 0 }
    },
  })

  const summary = defineGradTool({
    name: 'grad_ledger_summary',
    description: 'Aggregate ledger totals (minutes/hours) per month and organization, optionally filtered by category/year.',
    parameters: {
      category: { type: 'string', enum: ['volunteer', 'fitness', 'research', 'reading', 'custom'] },
      year: { type: 'integer' },
    },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        totalHours: { type: 'number' },
        count: { type: 'integer' },
        byMonth: { type: 'object', properties: {}, required: [], additionalProperties: true },
        byOrganization: { type: 'object', properties: {}, required: [], additionalProperties: true },
      },
      ['ok', 'totalHours', 'count'],
    ),
    execute(args) {
      const a = args as { category?: string; year?: number }
      const s = services.ledger.summary({ category: a.category as never, year: a.year })
      return Promise.resolve({
        ok: true,
        totalHours: Math.round((s.totalMinutes / 60) * 10) / 10,
        count: s.count,
        byMonth: s.byMonth,
        byOrganization: s.byOrganization,
      })
    },
  })

  const lastWorkout = defineGradTool({
    name: 'grad_workout_last',
    description: "Show the most recent logged workout with its exercises — the 'what did I do last time' lookup.",
    parameters: {},
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, found: { type: 'boolean' }, workout: { type: 'object', properties: {}, required: [], additionalProperties: true } },
      ['ok', 'found'],
    ),
    execute() {
      const w = services.ledger.lastWorkout()
      return Promise.resolve({ ok: true, found: Boolean(w), ...(w ? { workout: w } : {}) })
    },
  })

  return [add, workout, summary, lastWorkout]
}
