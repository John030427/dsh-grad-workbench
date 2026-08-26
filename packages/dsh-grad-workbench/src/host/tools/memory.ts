/**
 * Memory native-agent tools.
 * Policy: an explicit user "remember X" command writes confirmed memory;
 * agent-inferred personal facts go through grad_memory_propose (candidate,
 * userConfirmed=0) and need grad_memory_confirm from the user.
 */

import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

export function makeMemoryTools(services: HostServices): ToolDefinition[] {
  const remember = defineGradTool({
    name: 'grad_memory_remember',
    description:
      'Store a durable fact/preference/decision in Graduate OS scoped memory after the user EXPLICITLY asked to remember something ("记住…"/"remember that…"). Written as confirmed with source=user.',
    parameters: {
      content: { type: 'string', description: 'The fact to store, one self-contained sentence', required: true },
      kind: {
        type: 'string',
        enum: ['fact', 'preference', 'decision', 'lesson', 'entity', 'summary'],
        description: 'Memory kind; default fact',
      },
      project: { type: 'string', description: 'Project name to scope this memory to (optional)' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, memoryId: { type: 'string' }, scopeType: { type: 'string' }, confirmed: { type: 'boolean' } },
      ['ok', 'memoryId', 'scopeType', 'confirmed'],
    ),
    async execute(args) {
      const a = args as { content: string; kind?: string; project?: string }
      let projectId: string | undefined
      if (a.project) projectId = services.memory.ensureProject(a.project)
      const item = services.memory.remember({
        content: a.content,
        kind: a.kind as never,
        sourceType: 'user',
        userConfirmed: true,
        ...(a.project ? { scopeType: 'project' as const, scopeId: projectId ?? a.project } : {}),
      })
      return { ok: true, memoryId: item.id, scopeType: item.scopeType, confirmed: item.userConfirmed }
    },
  })

  const propose = defineGradTool({
    name: 'grad_memory_propose',
    description:
      'Propose a CANDIDATE memory (userConfirmed=0) when you inferred a personal fact/preference but the user did not explicitly ask to remember it. The user confirms or rejects it in the Memory Center.',
    parameters: {
      content: { type: 'string', required: true },
      kind: {
        type: 'string',
        enum: ['fact', 'preference', 'decision', 'lesson', 'entity', 'summary'],
        description: 'Default preference for inferred personal facts',
      },
      reason: { type: 'string', description: 'Why you think this is worth remembering (shown to the user)' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, memoryId: { type: 'string' }, status: { type: 'string' } },
      ['ok', 'memoryId', 'status'],
    ),
    async execute(args) {
      const a = args as { content: string; kind?: string; reason?: string }
      const item = services.memory.remember({
        content: a.content,
        kind: (a.kind ?? 'preference') as never,
        sourceType: 'workflow',
        userConfirmed: false,
        confidence: 0.5,
        ...(a.reason ? { sourceRef: `proposed:${a.reason.slice(0, 120)}` } : {}),
      })
      return { ok: true, memoryId: item.id, status: 'candidate-awaiting-user-confirmation' }
    },
  })

  const search = defineGradTool({
    name: 'grad_memory_search',
    description:
      'Search Graduate OS scoped memory before answering personal-context questions. Returns matched items with why-matched, source and age. Restricted items are excluded.',
    parameters: {
      query: { type: 'string', required: true },
      project: { type: 'string', description: 'Restrict to a project scope (global memories still included)' },
      limit: { type: 'integer', description: 'Max results (default 8)' },
    },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        count: { type: 'integer' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              kind: { type: 'string' },
              scopeType: { type: 'string' },
              why: { type: 'string' },
              ageDays: { type: 'integer' },
              sourceType: { type: 'string' },
              confirmed: { type: 'boolean' },
            },
            required: ['id', 'content'],
            additionalProperties: false,
          },
        },
      },
      ['ok', 'count', 'results'],
    ),
    execute(args) {
      const a = args as { query: string; project?: string; limit?: number }
      const results = services.memory.search({
        query: a.query,
        limit: a.limit ?? 8,
        ...(a.project ? { scopeType: 'project' as const, scopeId: a.project } : {}),
      })
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
          confirmed: r.item.userConfirmed,
        })),
      })
    },
  })

  const confirm = defineGradTool({
    name: 'grad_memory_confirm',
    description: "Mark a candidate memory as confirmed by the user (raises confidence, makes it first-class).",
    parameters: { memoryId: { type: 'string', required: true } },
    outputSchema: objectSchema({ ok: { type: 'boolean' }, confirmed: { type: 'boolean' } }, ['ok', 'confirmed']),
    async execute(args) {
      const item = await Promise.resolve(services.memory.confirm((args as { memoryId: string }).memoryId))
      return { ok: true, confirmed: item.userConfirmed }
    },
  })

  const forget = defineGradTool({
    name: 'grad_memory_delete',
    description: 'Delete a memory item by id after the user asked to remove/correct it. Soft-deleted but removed from search.',
    parameters: { memoryId: { type: 'string', required: true } },
    outputSchema: objectSchema({ ok: { type: 'boolean' }, deleted: { type: 'boolean' } }, ['ok', 'deleted']),
    async execute(args) {
      await Promise.resolve(services.memory.delete((args as { memoryId: string }).memoryId))
      return { ok: true, deleted: true }
    },
  })

  const update = defineGradTool({
    name: 'grad_memory_update',
    description:
      'Correct a memory: stores a NEW item superseding the old one (old stays traceable via supersedes chain), per the non-destructive memory policy.',
    parameters: {
      memoryId: { type: 'string', description: 'The outdated memory id to supersede', required: true },
      content: { type: 'string', description: 'The corrected content', required: true },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, newMemoryId: { type: 'string' }, supersedes: { type: 'string' } },
      ['ok', 'newMemoryId', 'supersedes'],
    ),
    execute(args) {
      const a = args as { memoryId: string; content: string }
      const old = services.memory.get(a.memoryId)
      const item = services.memory.remember({
        content: a.content,
        kind: old.kind,
        scopeType: old.scopeType,
        scopeId: old.scopeId,
        sensitivity: old.sensitivity,
        sourceType: 'user',
        userConfirmed: true,
        supersedesId: old.id,
      })
      return Promise.resolve({ ok: true, newMemoryId: item.id, supersedes: old.id })
    },
  })

  const explainRun = defineGradTool({
    name: 'grad_memory_explain_run',
    description:
      'Answer "which memories were used, why, from where, how old" for a workflow run — full memory provenance.',
    parameters: { runId: { type: 'string', required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        count: { type: 'integer' },
        usage: { type: 'array', items: { type: 'object', properties: {}, required: [], additionalProperties: true } },
      },
      ['ok', 'count', 'usage'],
    ),
    execute(args) {
      const runId = (args as { runId: string }).runId
      const usage = services.memory.explainRun(runId)
      return Promise.resolve({
        ok: true,
        count: usage.length,
        usage: usage.map((u) => ({
          memoryId: u.memory.id,
          content: u.memory.content,
          usedAt: u.usedAt,
          why: u.why,
          sourceType: u.memory.sourceType,
          createdAt: u.memory.createdAt,
        })),
      })
    },
  })

  return [remember, propose, search, confirm, update, forget, explainRun]
}
