/**
 * OpenAlex provider — primary discovery layer (works endpoint).
 * Docs: https://docs.openalex.org/api-entities/works
 */

import { createHash } from 'node:crypto'
import type { Paper, SourceRef } from '../../../shared/contracts.ts'
import type { AcademicProvider, AcademicQuery, AcademicSearchPage, FetchOptions } from '../provider-http.ts'
import { fetchJsonCached } from '../provider-http.ts'

interface OpenAlexWork {
  id: string
  doi?: string | null
  display_name?: string
  publication_year?: number
  publication_date?: string
  cited_by_count?: number
  type?: string
  open_access?: { is_oa?: boolean }
  primary_location?: { source?: { display_name?: string } | null } | null
  authorships?: Array<{ author?: { display_name?: string } }>
  abstract_inverted_index?: Record<string, number[]> | null
  relevance_score?: number
}

interface OpenAlexResponse {
  meta?: { count?: number }
  results?: OpenAlexWork[]
  error?: string
  message?: string
}

/** Reconstruct abstract text from an inverted index. */
export function abstractFromInvertedIndex(inv: Record<string, number[]>): string {
  const positions: Array<{ pos: number; word: string }> = []
  for (const [word, idxs] of Object.entries(inv)) {
    for (const pos of idxs) positions.push({ pos, word })
  }
  positions.sort((a, b) => a.pos - b.pos)
  return positions.map((p) => p.word).join(' ')
}

export function normalizeDoi(doi?: string | null): string | undefined {
  if (!doi) return undefined
  return doi.replace(/^https?:\/\/doi\.org\//i, '').toLowerCase()
}

export function workToPaper(work: OpenAlexWork, sourceRefs: SourceRef[] = []): Paper {
  const abstract = work.abstract_inverted_index ? abstractFromInvertedIndex(work.abstract_inverted_index) : undefined
  return {
    id: crypto.randomUUID(),
    title: work.display_name ?? '(untitled)',
    authors: (work.authorships ?? []).map((a) => a.author?.display_name ?? '').filter(Boolean),
    year: work.publication_year,
    date: work.publication_date,
    venue: work.primary_location?.source?.display_name ?? undefined,
    doi: normalizeDoi(work.doi),
    openAlexId: work.id ? work.id.replace('https://openalex.org/', '') : undefined,
    citationCount: work.cited_by_count,
    openAccess: work.open_access?.is_oa,
    abstractAvailable: Boolean(abstract),
    relevanceScore: work.relevance_score,
    evidenceLevel: abstract ? 'abstract' : 'metadata',
    sourceRefs,
  }
}

export class OpenAlexProvider implements AcademicProvider {
  readonly id = 'openalex'
  private readonly opts: FetchOptions & { cacheDir?: string }

  constructor(opts: FetchOptions & { cacheDir?: string } = {}) {
    this.opts = opts
  }

  async search(query: AcademicQuery): Promise<AcademicSearchPage> {
    const perPage = Math.min(Math.max(query.target * (query.poolFactor ?? 3), query.target), 200)
    const params = new URLSearchParams({
      search: query.topic,
      'per-page': String(Math.max(perPage, 1)),
      page: '1',
      mailto: 'grad-workbench@example.com',
    })
    if (query.since) {
      const from = /^\d{4}$/.test(query.since) ? `${query.since}-01-01` : query.since
      params.set('filter', `from_publication_date:${from}`)
    }
    const url = `https://api.openalex.org/works?${params.toString()}`
    const data = await fetchJsonCached<OpenAlexResponse>(url, this.opts)

    if (data.error || data.message) {
      // OpenAlex error payloads (rate limit budget etc.) surface honestly.
      const note = `${data.error ?? 'error'}: ${data.message ?? 'unknown provider message'}`
      return { papers: [], note }
    }

    const papers = (data.results ?? []).map((w) => {
      const refHash = createHash('sha256').update(w.id ?? w.display_name ?? '').digest('hex').slice(0, 16)
      return workToPaper(w, [
        { id: `openalex-${refHash}`, kind: 'provider-record', ref: w.id ?? '', createdAt: new Date().toISOString() },
      ])
    })
    return { papers, totalEstimate: data.meta?.count }
  }
}
