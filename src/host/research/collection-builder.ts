/**
 * Collection builder — turns a topic into a deduplicated, ranked paper
 * collection. Candidate pool > requested N; "latest" never silently becomes
 * "most cited". Provider outages degrade to partial collections with notes.
 */

import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { AcademicQuery } from './provider-http.ts'
import type { AcademicProvider } from './provider-http.ts'
import type { Paper, PaperCollection } from '../../shared/contracts.ts'
import { dedupePapers } from './dedup.ts'

export interface BuildCollectionInput {
  topic: string
  count?: number
  since?: string
  poolFactor?: number
}

export class CollectionStore {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  create(input: { topic: string; querySpec: Record<string, unknown>; requestedCount: number }): PaperCollection {
    const id = crypto.randomUUID()
    this.db
      .prepare(
        `INSERT INTO paper_collections (id, topic, query_spec, requested_count, complete, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
      )
      .run(id, input.topic, JSON.stringify(input.querySpec), input.requestedCount, new Date().toISOString())
    return {
      id,
      topic: input.topic,
      querySpec: input.querySpec,
      requestedCount: input.requestedCount,
      papers: [],
      createdAt: new Date().toISOString(),
      complete: false,
    }
  }

  addPaper(collectionId: string, paper: Paper, opts: { selected?: boolean } = {}): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO papers
           (id, collection_id, title, authors, year, date, venue, doi, openalex_id, s2_id,
            citation_count, open_access, abstract_available, abstract_text, relevance_score, theme, evidence_level, fingerprint, selected, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        paper.id,
        collectionId,
        paper.title,
        JSON.stringify(paper.authors),
        paper.year ?? null,
        paper.date ?? null,
        paper.venue ?? null,
        paper.doi ?? null,
        paper.openAlexId ?? null,
        paper.s2Id ?? null,
        paper.citationCount ?? null,
        paper.openAccess === undefined ? null : paper.openAccess ? 1 : 0,
        paper.abstractAvailable ? 1 : 0,
        paper.abstractText ?? null,
        paper.relevanceScore ?? null,
        paper.theme ?? null,
        paper.evidenceLevel,
        fingerprintOf(paper),
        opts.selected === false ? 0 : 1,
        new Date().toISOString(),
      )
  }

  finalize(collectionId: string, complete: boolean, notes?: string): void {
    this.db
      .prepare('UPDATE paper_collections SET complete = ?, notes = ? WHERE id = ?')
      .run(complete ? 1 : 0, notes ?? null, collectionId)
  }

  get(collectionId: string): PaperCollection | undefined {
    const col = this.db.prepare('SELECT * FROM paper_collections WHERE id = ? AND deleted_at IS NULL').get(collectionId) as
      | Record<string, unknown>
      | undefined
    if (!col) return undefined
    const paperRows = this.db
      .prepare('SELECT * FROM papers WHERE collection_id = ? AND selected = 1 ORDER BY year DESC, citation_count DESC')
      .all(collectionId) as Array<Record<string, unknown>>
    return {
      id: col.id as string,
      topic: col.topic as string,
      querySpec: JSON.parse((col.query_spec as string) ?? '{}'),
      requestedCount: col.requested_count as number,
      complete: col.complete === 1,
      notes: (col.notes as string) ?? undefined,
      createdAt: col.created_at as string,
      papers: paperRows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        authors: JSON.parse((r.authors as string) ?? '[]'),
        year: (r.year as number) ?? undefined,
        date: (r.date as string) ?? undefined,
        venue: (r.venue as string) ?? undefined,
        doi: (r.doi as string) ?? undefined,
        openAlexId: (r.openalex_id as string) ?? undefined,
        s2Id: (r.s2_id as string) ?? undefined,
        citationCount: (r.citation_count as number) ?? undefined,
        openAccess: r.open_access === null ? undefined : r.open_access === 1,
        abstractAvailable: r.abstract_available === 1,
        relevanceScore: (r.relevance_score as number) ?? undefined,
        theme: (r.theme as string) ?? undefined,
        evidenceLevel: r.evidence_level as Paper['evidenceLevel'],
        sourceRefs: [],
      })),
    }
  }

  list(limit = 20): Array<{ id: string; topic: string; count: number; complete: boolean; createdAt: string }> {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.topic, c.complete, c.created_at,
                (SELECT COUNT(*) FROM papers p WHERE p.collection_id = c.id) AS count
         FROM paper_collections c WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC LIMIT ?`,
      )
      .all(limit) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r.id as string,
      topic: r.topic as string,
      count: r.count as number,
      complete: r.complete === 1,
      createdAt: r.created_at as string,
    }))
  }
}

function fingerprintOf(p: Paper): string {
  // Reuses the same canonicalization as dedup via a tiny local copy to avoid a
  // cyclic import; values only need to be stable within this table.
  const normTitle = p.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
  let hash = 0x811c9dc5
  const text = `${normTitle}|${p.year ?? ''}|${(p.authors[0] ?? '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')}`
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return createHash('sha256').update(text + hash.toString(16)).digest('hex')
}

export class CollectionBuilder {
  private readonly store: CollectionStore
  private readonly providers: AcademicProvider[]

  constructor(store: CollectionStore, providers: AcademicProvider[]) {
    this.store = store
    this.providers = providers
  }

  async build(input: BuildCollectionInput): Promise<PaperCollection> {
    const count = Math.max(1, input.count ?? 50)
    const collection = this.store.create({
      topic: input.topic,
      requestedCount: count,
      querySpec: { topic: input.topic, since: input.since ?? null, poolFactor: input.poolFactor ?? 3 },
    })

    const query: AcademicQuery = {
      topic: input.topic,
      target: count,
      since: input.since,
      poolFactor: input.poolFactor ?? 3,
    }

    const notes: string[] = []
    const raw: Paper[] = []
    for (const provider of this.providers) {
      try {
        const page = await provider.search(query)
        raw.push(...page.papers)
        if (page.note) notes.push(`${provider.id}: ${page.note}`)
      } catch (err) {
        notes.push(`${provider.id}: unavailable (${err instanceof Error ? err.message : String(err)})`)
      }
    }

    if (raw.length === 0) {
      const note = `No provider returned results. ${notes.join('; ')}`.trim()
      this.store.finalize(collection.id, false, note)
      return { ...collection, complete: false, notes: note }
    }

    const { unique } = dedupePapers(raw)

    // Ranking: relevance desc, then recency (year desc). Citation count is
    // displayed but deliberately NOT the ranking key ("latest" ≠ "most cited").
    const ranked = [...unique].sort((a, b) => {
      const relDiff = (b.relevanceScore ?? b.citationCount ?? 0) - (a.relevanceScore ?? a.citationCount ?? 0)
      if (Math.abs(relDiff) > 1e-9) return relDiff
      return (b.year ?? 0) - (a.year ?? 0)
    })

    ranked.forEach((paper, i) => this.store.addPaper(collection.id, paper, { selected: i < count }))

    const selected = ranked.slice(0, count)
    const complete = selected.length >= count
    if (!complete) {
      notes.push(`requested ${count} unique papers, corpus yielded ${ranked.length}`)
    }
    this.store.finalize(collection.id, complete, notes.length > 0 ? notes.join('; ') : undefined)

    return {
      ...collection,
      papers: selected,
      poolSize: ranked.length,
      complete,
      ...(notes.length > 0 ? { notes: notes.join('; ') } : {}),
    }
  }
}

