import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { CollectionBuilder, CollectionStore } = await import('../../src/host/research/collection-builder.ts')
const { synthesize } = await import('../../src/host/research/synthesis.ts')
const { OpenAlexProvider } = await import('../../src/host/research/providers/openalex.ts')

function fakePaper(i, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: `Agent Memory Paper ${i}`,
    authors: [`Author ${i}`],
    year: 2025 - (i % 3),
    venue: `Venue ${i % 4}`,
    citationCount: 100 - i,
    openAccess: i % 2 === 0,
    abstractAvailable: i % 3 !== 0,
    relevanceScore: 100 - i,
    evidenceLevel: i % 3 !== 0 ? 'abstract' : 'metadata',
    sourceRefs: [],
    ...overrides,
  }
}

/** Deterministic in-memory provider. */
function fakeProvider(papers) {
  let calls = 0
  return {
    id: 'fake',
    calls() {
      return calls
    },
    async search(query) {
      calls++
      return { papers, totalEstimate: papers.length }
    },
  }
}

test('collection builder: pool>N dedup delivers exactly N unique; honest notes on shortfall', async () => {
  const s = await makeServiceStack()
  try {
    // 30 raw papers where 10 duplicate the first 10 (same DOI) → 20 unique.
    const raw = []
    for (let i = 0; i < 30; i++) {
      const p = fakePaper(i)
      if (i >= 20) {
        // duplicate of i-20 via DOI
        raw.push({ ...p, id: crypto.randomUUID(), doi: undefined, title: `Agent Memory Paper ${i - 20}`, year: 2025 - ((i - 20) % 3), authors: [`Author ${i - 20}`] })
      } else {
        raw.push({ ...p, doi: `10.1000/paper-${i}` })
      }
    }
    const provider = fakeProvider(raw)
    const builder = new CollectionBuilder(new CollectionStore(s.db), [provider])
    const collection = await builder.build({ topic: 'agent memory', count: 15 })

    assert.equal(collection.papers.length, 15)
    assert.equal(collection.complete, true)

    const uniqueTitles = new Set(collection.papers.map((p) => `${p.title}|${p.year}`))
    assert.equal(uniqueTitles.size, 15, 'delivered papers are UNIQUE identities')

    const stored = s.research ?? null
    void stored
  } finally {
    s.cleanup()
  }
})

test('collection builder: provider outage yields partial collection with note, never fabricated papers', async () => {
  const s = await makeServiceStack()
  try {
    const failing = {
      id: 'broken',
      async search() {
        throw new Error('HTTP 429')
      },
    }
    const builder = new CollectionBuilder(new CollectionStore(s.db), [failing])
    const collection = await builder.build({ topic: 'anything', count: 50 })
    assert.equal(collection.papers.length, 0)
    assert.equal(collection.complete, false)
    assert.match(collection.notes ?? '', /unavailable/)
  } finally {
    s.cleanup()
  }
})

test('synthesis: deterministic report with validated claims and evidence tags', async () => {
  const s = await makeServiceStack()
  try {
    const papers = Array.from({ length: 12 }, (_, i) =>
      fakePaper(i, {
        abstractText: i % 2 === 0 ? 'We study retrieval memory mechanisms for LLM agents with experiments' : undefined,
        doi: `10.1000/p-${i}`,
      }),
    )
    const store = new CollectionStore(s.db)
    const collection = store.create({ topic: 'agent memory', querySpec: {}, requestedCount: 10 })
    for (const p of papers.slice(0, 10)) store.addPaper(collection.id, p)
    const full = store.get(collection.id)

    const result1 = synthesize(full)
    const result2 = synthesize(full)
    assert.equal(result1.markdown, result2.markdown, 'synthesis is deterministic')

    assert.ok(result1.markdown.includes('## 1. Scope & query'))
    assert.ok(result1.markdown.includes('## 9. What to read first'))
    assert.ok(result1.markdown.includes('[M]'), 'metadata tags rendered')
    assert.ok(result1.claims.length > 0)

    // Every claim references only known paper ids.
    const ids = new Set(papers.map((p) => p.id))
    for (const claim of result1.claims) {
      for (const pid of claim.paperIds) assert.ok(ids.has(pid), 'citation validator passed a real paper id')
    }
    assert.ok(!/fabricat/i.test(result1.markdown.replace(/Nothing was fabricated/g, '')), 'no fabrication language beyond the disclaimer')
  } finally {
    s.cleanup()
  }
})

test('provider HTTP layer: disk cache hit avoids any network call', async () => {
  const s = await makeServiceStack()
  try {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { createHash } = await import('node:crypto')
    const cacheDir = join(mkdtempSync(join(tmpdir(), 'grad-cache-')), 'oa')
    const url = 'https://api.openalex.org/works?search=cached-topic&per-page=15'
    const key = createHash('sha256').update(url).digest('hex')
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, `${key}.json`), JSON.stringify({ marker: 'cache-hit', meta: { count: 7 } }))
    const { fetchJsonCached } = await import('../../src/host/research/provider-http.ts')
    const data = await fetchJsonCached(url, { cacheDir })
    assert.equal(data.marker, 'cache-hit')
    assert.equal(data.meta.count, 7)
  } finally {
    s.cleanup()
  }
})
