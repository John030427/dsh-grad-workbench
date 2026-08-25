import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { dedupePapers, paperFingerprint } = await import('../../src/host/research/dedup.ts')
const { workToPaper, normalizeDoi, abstractFromInvertedIndex } = await import('../../src/host/research/providers/openalex.ts')
const fixture = JSON.parse(readFileSync(new URL('../../fixtures/openalex-dupes.json', import.meta.url), 'utf8'))

function withProviderRefs(papers) {
  return papers.map((p) => {
    if (p.openAlexId) {
      p.sourceRefs.push({
        id: `oa-${p.openAlexId}`,
        kind: 'provider-record',
        ref: p.openAlexId,
        createdAt: new Date().toISOString(),
      })
    }
    return p
  })
}

test('normalizeDoi lowercases and strips prefix', () => {
  assert.equal(normalizeDoi('https://DOI.org/10.1000/ABC'), '10.1000/abc')
  assert.equal(normalizeDoi(undefined), undefined)
})

test('abstract reconstruction preserves word order', () => {
  const text = abstractFromInvertedIndex({ Memory: [0, 6], is: [1], central: [2] })
  assert.equal(text.startsWith('Memory is central'), true)
})

test('dedup: DOI-cased duplicates merge; fingerprint fallback catches title+year+author', () => {
  const raw = withProviderRefs(fixture.results.map((w) => workToPaper(w)))
  // W1+W2 same DOI (case-insensitive); W4+W5 same title+year+first author
  const { unique, merged } = dedupePapers(raw)
  assert.equal(raw.length, 6)
  assert.equal(unique.length, 4, `expected 4 unique, got ${unique.length}: ${unique.map((u) => u.title)}`)
  assert.equal(merged, 2)

  const survey = unique.find((p) => p.title.includes('Survey of Memory'))
  assert.ok(survey, 'survey survives as one record')
  assert.equal(survey.citationCount, 120, 'better citation data absorbed')
  assert.ok(survey.abstractAvailable, 'abstract availability absorbed from duplicate')

  const rag = unique.find((p) => p.title.startsWith('Retrieval-Augmented'))
  assert.ok(rag, 'RAG paper survives')
  assert.equal(rag.openAlexId, 'W4', 'survivor keeps its own canonical OpenAlex id')
})

test('dedup: provider records preserved as sourceRefs on survivors', () => {
  const raw = withProviderRefs(fixture.results.map((w) => workToPaper(w)))
  const { unique } = dedupePapers(raw)
  const survey = unique.find((p) => p.title.includes('Survey of Memory'))
  const oaRefs = survey.sourceRefs.filter((s) => s.kind === 'provider-record')
  assert.ok(oaRefs.length >= 2, 'duplicate provider records kept as provenance')
})

test('fingerprint is stable across punctuation/case', () => {
  const a = paperFingerprint({ title: 'Retrieval-Augmented Generation, Revisited!', year: 2025, authors: ['Dan WU'] })
  const b = paperFingerprint({ title: 'retrieval augmented generation revisited', year: 2025, authors: ['dan wu'] })
  assert.equal(a, b)
})
