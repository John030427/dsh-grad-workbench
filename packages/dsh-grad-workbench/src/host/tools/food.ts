/** Food Map native-agent tools. Ambiguous places stay unresolved by design. */

import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

const restaurantSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    status: { type: 'string' },
    address: { type: 'string' },
    cuisines: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['id', 'name', 'status'],
  additionalProperties: false,
}

export function makeFoodTools(services: HostServices): ToolDefinition[] {
  const save = defineGradTool({
    name: 'grad_food_save',
    description:
      'Save a restaurant candidate (from a screenshot, post or conversation). Saved as UNRESOLVED — it only becomes a map pin after the user confirms the place. Never auto-confirm an ambiguous location.',
    parameters: {
      name: { type: 'string', required: true },
      note: { type: 'string', description: 'Why it is interesting / who recommended it' },
      cuisine: { type: 'string', description: 'Cuisine tag, e.g. 烤肉 / sushi' },
      sourceText: { type: 'string', description: 'Original text the restaurant was extracted from' },
      city: { type: 'string' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, restaurantId: { type: 'string' }, status: { type: 'string' } },
      ['ok', 'restaurantId', 'status'],
    ),
    execute(args) {
      const a = args as { name: string; note?: string; cuisine?: string; sourceText?: string; city?: string }
      const r = services.food.save(a)
      return Promise.resolve({ ok: true, restaurantId: r.id, status: r.status })
    },
  })

  const confirm = defineGradTool({
    name: 'grad_food_confirm',
    description:
      'Turn an unresolved restaurant into a confirmed pin using USER-PROVIDED place info (address or coordinates). Requires explicit user choice among candidates.',
    parameters: {
      restaurantId: { type: 'string', required: true },
      address: { type: 'string', description: 'User-confirmed address' },
      lat: { type: 'number' },
      lng: { type: 'number' },
      city: { type: 'string' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, restaurantId: { type: 'string' }, status: { type: 'string' }, address: { type: 'string' } },
      ['ok', 'restaurantId', 'status'],
    ),
    async execute(args) {
      const a = args as { restaurantId: string; address?: string; lat?: number; lng?: number; city?: string }
      const r = await Promise.resolve(services.food.confirm(a.restaurantId, a))
      return { ok: true, restaurantId: r.id, status: r.status, ...(r.address ? { address: r.address } : {}) }
    },
  })

  const list = defineGradTool({
    name: 'grad_food_list',
    description: 'List saved restaurants, optionally filtered by status (want_to_try/visited/favorite/avoid/unresolved) or a text query over names/tags.',
    parameters: {
      status: {
        type: 'string',
        enum: ['want_to_try', 'visited', 'favorite', 'avoid', 'unresolved'],
        description: 'Filter by pin status',
      },
      query: { type: 'string', description: 'Text filter over name/tags/cuisines' },
      limit: { type: 'integer' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, count: { type: 'integer' }, restaurants: { type: 'array', items: restaurantSchema } },
      ['ok', 'count', 'restaurants'],
    ),
    execute(args) {
      const a = args as { status?: string; query?: string; limit?: number }
      const list = services.food.list({ status: a.status as never, query: a.query, limit: a.limit ?? 50 })
      return Promise.resolve({
        ok: true,
        count: list.length,
        restaurants: list.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          ...(r.address ? { address: r.address } : {}),
          ...(r.cuisines.length ? { cuisines: r.cuisines } : {}),
          ...(r.notes ? { notes: r.notes } : {}),
        })),
      })
    },
  })

  const updateStatus = defineGradTool({
    name: 'grad_food_update_status',
    description:
      "Update a restaurant's user status (visited/favorite/want_to_try/avoid) with an optional personal rating 1-5.",
    parameters: {
      restaurantId: { type: 'string', required: true },
      status: { type: 'string', enum: ['want_to_try', 'visited', 'favorite', 'avoid'], required: true },
      rating: { type: 'integer', description: 'Personal rating 1-5' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, restaurantId: { type: 'string' }, status: { type: 'string' } },
      ['ok', 'restaurantId', 'status'],
    ),
    async execute(args) {
      const a = args as { restaurantId: string; status: 'want_to_try' | 'visited' | 'favorite' | 'avoid'; rating?: number }
      const r = await Promise.resolve(services.food.setStatus(a.restaurantId, a.status, a.rating))
      return { ok: true, restaurantId: r.id, status: r.status }
    },
  })

  return [save, confirm, list, updateStatus]
}
