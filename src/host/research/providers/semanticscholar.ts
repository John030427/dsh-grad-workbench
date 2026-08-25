/**
 * Semantic Scholar provider — enrichment/cross-check layer.
 * Public tier is aggressively rate-limited: a single best-effort search page,
 * backoff once on 429, then degrade quietly (never fail the whole collection).
 */

import type { Paper } from '../../../shared/contracts.ts'
import type { AcademicProvider, AcademicQuery, AcademicSearchPage, FetchOptions } from '../provider-http.ts'
import { fetchJsonCached } from '../provider-http.ts'

interface S2Paper {
  paperId?: string
  title?: string
  year?: number
  abstract?: string | null
  citationCount?: number
  venue?: string
  authors?: Array<{ name?: string }>
  externalIds?: { DOI?: string; CorpusId?: number }
}

interface S2Response {
  total?: number
  data?: S2Paper[]
  message?: string
}

export class SemanticScholarProvider implements AcademicProvider {
  readonly id = 'semanticscholar'
  private readonly opts: FetchOptions & { cacheDir?: string }

  constructor(opts: FetchOptions & { cacheDir?: string } = {}) {
    this.opts = opts
  }

  async search(query: AcademicQuery): Promise<AcademicSearchPage> {
    const limit = Math.min(Math.max(query.target, 1), 100)
    const params = new URLSearchParams({
      query: query.topic,
      limit: String(limit),
      fields: 'title,year,abstract,citationCount,venue,authors,externalIds',
    })
    if (query.since) {
      const year = /^\d{4}$/.test(query.since) ? Number(query.since) : Number(query.since.slice(0, 4))
      if (Number.isFinite(year)) params.set('year', `${year}-`)
    }
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`
    try {
      const data = await fetchJsonCached<S2Response>(url, { ...this.opts, retries: this.opts.retries ?? 1 })
      const papers: Paper[] = (data.data ?? []).map((p) => ({
        id: crypto.randomUUID(),
        title: p.title ?? '(untitled)',
        authors: (p.authors ?? []).map((a: { name?: string }) => a.name ?? '').filter(Boolean),
        year: p.year,
        venue: p.venue || undefined,
        doi: p.externalIds?.DOI?.toLowerCase(),
        s2Id: p.paperId,
        citationCount: p.citationCount,
        openAccess: undefined,
        abstractAvailable: Boolean(p.abstract),
        evidenceLevel: p.abstract ? 'abstract' : 'metadata',
        sourceRefs: [],
      }))
      return { papers, totalEstimate: data.total }
    } catch (err) {
      return { papers: [], note: `semanticscholar unavailable: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
}
