/** Communication assistant tools. Drafts only — sending is a separate approval flow. */

import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

export function makeCommunicationTools(services: HostServices): ToolDefinition[] {
  const understand = defineGradTool({
    name: 'grad_comm_understand',
    description:
      'Analyze an advisor/teacher message: relationship, scenario, intent, risk, key points and explicit commitments/deadlines. Deterministic keyword analysis — present as hints to the user, not facts.',
    parameters: { text: { type: 'string', description: 'The received message text', required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        relationship: { type: 'string' },
        scenario: { type: 'string' },
        intent: { type: 'string' },
        risk: { type: 'string' },
        coreDemand: { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
        commitments: {
          type: 'array',
          items: {
            type: 'object',
            properties: { what: { type: 'string' }, due: { type: 'string' } },
            required: ['what'],
            additionalProperties: false,
          },
        },
      },
      ['ok', 'relationship', 'scenario', 'intent', 'risk', 'coreDemand'],
    ),
    execute(args) {
      const text = (args as { text: string }).text
      return Promise.resolve({ ok: true, ...services.communication.understand(text) })
    },
  })

  const draft = defineGradTool({
    name: 'grad_comm_draft_reply',
    description:
      'Draft replies to an advisor/teacher message in multiple tones. NEVER invents progress: substantive claims come only from myUpdate text the user supplied; missing parts render explicit fill-in placeholders. Drafts are not sent.',
    parameters: {
      originalText: { type: 'string', description: 'The received message being replied to', required: true },
      myUpdate: { type: 'string', description: 'Facts from the user about actual progress/plans (the only source of substance)' },
    },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        drafts: {
          type: 'array',
          items: {
            type: 'object',
            properties: { tone: { type: 'string' }, markdown: { type: 'string' } },
            required: ['tone', 'markdown'],
            additionalProperties: false,
          },
        },
        contextUsed: {
          type: 'array',
          items: { type: 'object', properties: { content: { type: 'string' }, why: { type: 'string' } }, required: ['content'], additionalProperties: false },
          description: 'Memory items consulted while drafting (with provenance)',
        },
        savedArtifactId: { type: 'string' },
      },
      ['ok', 'drafts'],
    ),
    async execute(args) {
      const a = args as { originalText: string; myUpdate?: string }
      const result = services.communication.draft({
        originalText: a.originalText,
        userFacts: a.myUpdate,
      })
      const chosen = result.drafts[0]!
      const saved = services.communication.saveDraft({ originalText: a.originalText, markdown: chosen.markdown })
      return Promise.resolve({
        ok: true,
        drafts: result.drafts.map((d) => ({ tone: d.tone, markdown: d.markdown })),
        contextUsed: result.contextUsed,
        savedArtifactId: saved.artifactId,
      })
    },
  })

  return [understand, draft]
}
