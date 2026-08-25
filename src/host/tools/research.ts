/** Research radar native-agent tools. */

import { isGradError } from '../../shared/errors.ts'
import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

export function makeResearchTools(services: HostServices): ToolDefinition[] {
  const latest = defineGradTool({
    name: 'grad_research_latest',
    description:
      'Collect the LATEST unique papers on a topic from academic providers (OpenAlex primary; Semantic Scholar enrichment). Deduplicates DOI/OpenAlex/S2 identities, ranks by relevance then recency, and stores a collection. Rate-limited providers yield honest partial results — the response says so.',
    parameters: {
      topic: { type: 'string', description: 'Research topic, e.g. "LLM agent memory"', required: true },
      count: { type: 'integer', description: 'Unique papers wanted (default 50, max 200)' },
      since: { type: 'string', description: 'Only papers from this year or date, e.g. "2025" or "2025-06-01"' },
    },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        collectionId: { type: 'string' },
        delivered: { type: 'integer' },
        requested: { type: 'integer' },
        complete: { type: 'boolean' },
        note: { type: 'string' },
        topTitles: { type: 'array', items: { type: 'string' }, description: 'First few collected titles' },
      },
      ['ok', 'collectionId', 'delivered', 'requested', 'complete'],
    ),
    async execute(args) {
      const a = args as { topic: string; count?: number; since?: string }
      try {
        const collection = await services.research.latest({
          topic: a.topic,
          count: Math.min(a.count ?? 50, 200),
          since: a.since,
        })
        return {
          ok: true,
          collectionId: collection.id,
          delivered: collection.papers.length,
          requested: collection.requestedCount,
          complete: collection.complete,
          ...(collection.notes ? { note: collection.notes } : {}),
          topTitles: collection.papers.slice(0, 5).map((p) => p.title),
        }
      } catch (err) {
        if (isGradError(err) && !err.retryable) throw err
        throw err
      }
    },
  })

  const getCollection = defineGradTool({
    name: 'grad_research_get_collection',
    description: 'Fetch one stored paper collection with full paper rows (titles, authors, years, venues, evidence levels).',
    parameters: { collectionId: { type: 'string', required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        found: { type: 'boolean' },
        collection: { type: 'object', properties: {}, required: [], additionalProperties: true },
      },
      ['ok', 'found'],
    ),
    execute(args) {
      const collectionId = (args as { collectionId: string }).collectionId
      const collection = services.research.get(collectionId)
      return Promise.resolve({ ok: true, found: Boolean(collection), ...(collection ? { collection } : {}) })
    },
  })

  const synthesize = defineGradTool({
    name: 'grad_research_synthesize',
    description:
      'Generate the deterministic cited Markdown report for a stored collection (evidence-tagged claims, theme clusters, year trend, reading shortlist). Local artifact only; publishing externally requires an approval flow.',
    parameters: { collectionId: { type: 'string', required: true } },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, artifactId: { type: 'string' }, claimCount: { type: 'integer' }, warnings: { type: 'array', items: { type: 'string' } } },
      ['ok', 'artifactId'],
    ),
    async execute(args) {
      const collectionId = (args as { collectionId: string }).collectionId
      const result = await Promise.resolve(services.research.synthesizeToArtifact(collectionId))
      return {
        ok: true,
        artifactId: result.artifactId,
        warnings: result.warnings,
        ...(result.claimCount !== undefined ? { claimCount: result.claimCount } : {}),
      }
    },
  })

  return [latest, getCollection, synthesize]
}
