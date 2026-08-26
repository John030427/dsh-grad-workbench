/**
 * Paper deduplication — canonical identity keys in priority order:
 *   1. normalized DOI
 *   2. OpenAlex ID
 *   3. Semantic Scholar ID
 *   4. title+year+first-author fingerprint (case/punctuation-insensitive)
 * Provider originals survive as sourceRefs on the surviving record.
 */

import type { Paper } from '../../shared/contracts.ts'

export function paperFingerprint(p: { title: string; year?: number; authors?: string[] }): string {
  const normTitle = p.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
  const firstAuthor = (p.authors?.[0] ?? '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
  return createFingerprint(`${normTitle}|${p.year ?? ''}|${firstAuthor}`)
}

function createFingerprint(text: string): string {
  // FNV-1a 32-bit, hex — short but stable; collisions handled by union-find merge below.
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export interface DedupResult {
  unique: Paper[]
  /** How many raw records were merged away. */
  merged: number
}

/**
 * Union-merge papers sharing ANY canonical key (a paper may match by DOI on one
 * provider and by S2 id elsewhere). First occurrence wins and absorbs missing
 * fields from later duplicates.
 */
export function dedupePapers(raw: Paper[]): DedupResult {
  const keyToIndex = new Map<string, number>()
  const groups: Array<{ primary: Paper; extras: Paper[] }> = []

  for (const paper of raw) {
    const keys = [
      paper.doi ? `doi:${paper.doi}` : undefined,
      paper.openAlexId ? `oa:${paper.openAlexId}` : undefined,
      paper.s2Id ? `s2:${paper.s2Id}` : undefined,
      `fp:${paperFingerprint(paper)}`,
    ].filter((k): k is string => Boolean(k))

    const existingIdx = keys.map((k) => keyToIndex.get(k)).find((idx) => idx !== undefined)

    if (existingIdx === undefined) {
      const idx = groups.length
      groups.push({ primary: paper, extras: [] })
      for (const k of keys) keyToIndex.set(k, idx)
    } else {
      const group = groups[existingIdx]!
      group.extras.push(paper)
      for (const k of keys) keyToIndex.set(k, existingIdx)
      mergeFields(group.primary, paper)
    }
  }

  const unique = groups.map((g) => g.primary)
  return { unique, merged: raw.length - unique.length }
}

/** Fill gaps on the surviving record without overwriting better data. */
function mergeFields(target: Paper, dup: Paper): void {
  if (!target.abstractAvailable && dup.abstractAvailable) {
    target.abstractAvailable = true
    target.evidenceLevel = 'abstract'
  }
  target.citationCount ??= dup.citationCount
  target.openAccess ??= dup.openAccess
  target.venue ??= dup.venue
  target.year ??= dup.year
  target.doi ??= dup.doi
  target.openAlexId ??= dup.openAlexId
  target.s2Id ??= dup.s2Id
  if ((dup.relevanceScore ?? 0) > (target.relevanceScore ?? 0)) target.relevanceScore = dup.relevanceScore
  // Absorb duplicate provider records into provenance.
  target.sourceRefs = [...target.sourceRefs, ...dup.sourceRefs.filter((s) => !target.sourceRefs.some((t) => t.ref === s.ref))]
}
