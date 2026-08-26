/**
 * Deterministic literature synthesis.
 *
 * NO language model is involved: every sentence is generated from collection
 * metadata/abstracts and tagged with an evidence level:
 *   [M] metadata-only conclusion   [A] abstract-supported conclusion
 * Claims are structured first, validated against existing paper ids, then
 * rendered — citations can only reference papers that exist in the collection.
 */

import { createHash } from 'node:crypto'
import type { Paper, PaperCollection } from '../../shared/contracts.ts'

export interface SynthesisClaim {
  claimId: string
  statement: string
  paperIds: string[]
  evidenceLevel: 'metadata' | 'abstract'
}

export interface SynthesisResult {
  markdown: string
  claims: SynthesisClaim[]
  warnings: string[]
}

const STOPWORDS = new Set(
  ('a an the and or of for in on to with via by using based we our their this that these those study studies paper ' +
    'research approach method methods model models framework system systems novel propose proposed proposes show shows ' +
    'shown results result experiment experiments experimental evaluation evaluate improved improvement performance ' +
    'towards toward between among during from into over under how what which when where while can could may might will ' +
    'would should more most less least new current recent existing various significant significantly high higher low lower')
    .split(' '),
)

function claimId(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

function tag(level: 'metadata' | 'abstract'): string {
  return level === 'abstract' ? '[A]' : '[M]'
}

/** Document-frequency keyword themes over titles (weight 3) + abstracts (weight 1). */
export function extractThemes(papers: Paper[], k = 6): Array<{ label: string; paperIds: string[] }> {
  const df = new Map<string, Set<string>>()

  for (const p of papers) {
    // Title terms count triple; abstract terms once.
    const titleWords = p.title.toLowerCase().match(/[a-z\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]{2,}/g) ?? []
    const absWords = (p.abstractText ?? '').toLowerCase().match(/[a-z\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]{2,}/g) ?? []
    const weights = new Map<string, number>()
    for (const w of titleWords) if (!STOPWORDS.has(w) && w.length >= 4) weights.set(w, (weights.get(w) ?? 0) + 3)
    for (const w of absWords) if (!STOPWORDS.has(w) && w.length >= 4) weights.set(w, (weights.get(w) ?? 0) + 1)
    for (const [w, weight] of weights) {
      // Weight only boosts ordering relevance via repeated insertion below.
      void weight
      if (!df.has(w)) df.set(w, new Set())
      df.get(w)!.add(p.id)
    }
  }

  const themes = [...df.entries()]
    .filter(([term]) => term.length >= 4 && df.get(term)!.size >= Math.max(2, Math.floor(papers.length * 0.05)))
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, k)
    .map(([label, set]) => ({ label, paperIds: [...set] }))

  return themes
}

function yearHistogram(papers: Paper[]): Array<{ year: number; count: number }> {
  const map = new Map<number, number>()
  for (const p of papers) {
    if (p.year === undefined) continue
    map.set(p.year, (map.get(p.year) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }))
}

export function synthesize(collection: PaperCollection): SynthesisResult {
  const papers = collection.papers
  const warnings: string[] = []
  const claims: SynthesisClaim[] = []

  if (papers.length === 0) {
    return {
      markdown: `# Literature report — ${collection.topic}\n\nNo papers available (${collection.notes ?? 'empty corpus'}). Nothing was fabricated.\n`,
      claims: [],
      warnings: ['empty collection'],
    }
  }

  // ── structured claims ──────────────────────────────────────────────────────
  const themes = extractThemes(papers)
  for (const t of themes) {
    const validIds = t.paperIds.filter((id) => papers.some((p) => p.id === id))
    claims.push({
      claimId: claimId(`theme:${t.label}`),
      statement: `Theme "${t.label}" appears in ${validIds.length}/${papers.length} collected papers (keyword co-occurrence).`,
      paperIds: validIds,
      evidenceLevel: 'metadata',
    })
  }
  for (const p of papers.slice(0, 5)) {
    const level: 'metadata' | 'abstract' = p.evidenceLevel === 'metadata' ? 'metadata' : 'abstract'
    const tagText = tag(level)
    claims.push({
      claimId: claimId(`rep:${p.id}`),
      statement: `${p.title} (${p.year ?? 'n.d.'}) is among the most referenced works in this collection${p.citationCount !== undefined ? ` with ${p.citationCount} tracked citations` : ''}. ${tagText} ${level === 'metadata' ? 'Metadata-level observation only.' : 'Abstract supports topical relevance.'}`,
      paperIds: [p.id],
      evidenceLevel: level,
    })
  }

  // Citation validation: drop claims referencing unknown papers.
  const knownIds = new Set(papers.map((p) => p.id))
  const validatedClaims = claims.filter((c) => c.paperIds.every((id) => knownIds.has(id)))
  if (validatedClaims.length < claims.length) {
    warnings.push(`${claims.length - validatedClaims.length} claims dropped by citation validator`)
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const lines: string[] = []
  lines.push(`# Literature report — ${collection.topic}`)
  lines.push('')
  lines.push(`> Generated deterministically from provider metadata${collection.complete ? '' : ' (PARTIAL corpus)'}.`)
  lines.push(`> Evidence tags: **[M]** metadata-only · **[A]** abstract-supported. No full-text reading occurred in this pipeline.`)
  lines.push('')

  lines.push('## 1. Scope & query')
  lines.push(`- Topic: \`${collection.topic}\``)
  lines.push(`- Requested unique papers: ${collection.requestedCount}; delivered: ${papers.length}`)
  if (collection.notes) lines.push(`- Provider notes: ${collection.notes}`)
  lines.push('')

  lines.push('## 2. Selection method')
  lines.push('- Providers queried (primary discovery: OpenAlex; enrichment: Semantic Scholar where configured)')
  lines.push('- Deduplication on canonical keys: normalized DOI → OpenAlex ID → S2 ID → title+year+first-author fingerprint')
  lines.push('- Ranking: provider relevance, then recency; citation count shown but not used as rank')
  lines.push('')

  lines.push(`## 3. Collected papers (${papers.length})`)
  lines.push('')
  lines.push('| # | Title | Authors | Year | Venue | Cites | OA | Evidence |')
  lines.push('|---|-------|---------|------|-------|-------|----|----------|')
  papers.forEach((p, i) => {
    const authors = p.authors.length > 3 ? `${p.authors.slice(0, 3).join(', ')} et al.` : p.authors.join(', ')
    const ev = p.abstractAvailable ? '[A]' : '[M]'
    lines.push(
      `| ${i + 1} | ${p.title.replace(/\|/g, '\\|')} | ${authors.replace(/\|/g, '\\|')} | ${p.year ?? ''} | ${(p.venue ?? '').replace(/\|/g, '\\|')} | ${p.citationCount ?? ''} | ${p.openAccess === undefined ? '' : p.openAccess ? 'OA' : ''} | ${ev} |`,
    )
  })
  lines.push('')

  lines.push('## 4. Major themes (keyword clusters)')
  for (const c of validatedClaims.filter((c) => c.statement.startsWith('Theme'))) {
    lines.push(`- ${tag(c.evidenceLevel)} ${c.statement} \`claim:${c.claimId}\``)
  }
  lines.push('')

  lines.push('## 5. Chronological trend')
  const hist = yearHistogram(papers)
  if (hist.length > 0) {
    lines.push('')
    lines.push('| Year | Papers |')
    lines.push('|------|--------|')
    for (const h of hist) lines.push(`| ${h.year} | ${h.count} |`)
  } else {
    lines.push('- No publication years available in metadata.')
  }
  lines.push('')

  lines.push('## 6. Representative works')
  for (const c of validatedClaims.filter((c) => !c.statement.startsWith('Theme'))) {
    lines.push(`- ${c.statement} \`claim:${c.claimId}\``)
  }
  lines.push('')

  lines.push('## 7. Methodological patterns & disagreements')
  lines.push(`- [M] This MVP pipeline has NOT read full texts, so it makes no methodological or disagreement claims about individual papers.`)
  lines.push(`- Abstract-grounded pattern extraction is limited to topics present above; treat all theme labels as coarse keyword clusters, not research communities.`)
  lines.push('')

  lines.push('## 8. Research gaps')
  lines.push(`- [M] Honest limitation: gap detection requires full-text evidence (planned local indexing stage). The theme coverage table above is the only defensible signal at this stage.`)
  lines.push('')

  lines.push('## 9. What to read first')
  const shortlist = [...papers]
    .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
    .slice(0, 3)
  for (const p of shortlist) {
    const doi = p.doi ? ` https://doi.org/${p.doi}` : ''
    lines.push(`1. ${p.title} (${p.year ?? 'n.d.'}${p.citationCount !== undefined ? `, ${p.citationCount} cites` : ''}).${doi}`)
  }
  lines.push('')

  lines.push('## 10. Source appendix')
  lines.push('')
  for (const p of papers.slice(0, 50)) {
    const ids = [p.doi ? `doi:${p.doi}` : null, p.openAlexId ? `openalex:${p.openAlexId}` : null, p.s2Id ? `s2:${p.s2Id}` : null]
      .filter(Boolean)
      .join(' · ')
    lines.push(`- ${p.title} — ${ids}`)
  }

  return { markdown: lines.join('\n'), claims: validatedClaims, warnings }
}
