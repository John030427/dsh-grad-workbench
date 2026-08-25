import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

test('memory: remember → search returns why/source/age; FTS match quality', async () => {
  const s = await makeServiceStack()
  try {
    s.memory.remember({ content: 'Preferred reply tone with advisor: formal but concise', sourceType: 'user', userConfirmed: true })
    const projectId = s.memory.ensureProject('agent-memory-survey')
    s.memory.remember({
      content: 'Research question: how do LLM agents persist memory across sessions',
      scopeType: 'project',
      scopeId: projectId,
      sourceType: 'user',
      userConfirmed: true,
    })

    const hits = s.memory.search({ query: 'reply tone advisor' })
    assert.ok(hits.length >= 1)
    assert.equal(hits[0].item.kind, 'fact')
    assert.ok(hits[0].why.includes('FTS'), `why explains match: ${hits[0].why}`)
    assert.equal(hits[0].ageDays, 0)
    assert.ok(hits[0].score > 1)

    // Project-scoped query still reaches global memories but filters project ones.
    const scoped = s.memory.search({ query: 'memory agents', scopeType: 'project', scopeId: projectId })
    assert.ok(scoped.some((r) => r.item.scopeId === projectId))

    // Unrelated query → no forced matches.
    assert.equal(s.memory.search({ query: 'quantum knitting' }).length, 0)
  } finally {
    s.cleanup()
  }
})

test('memory: candidates need confirmation; supersession keeps history', async () => {
  const s = await makeServiceStack()
  try {
    const candidate = s.memory.remember({ content: 'User prefers morning workouts', kind: 'preference', sourceType: 'workflow', userConfirmed: false })
    assert.equal(candidate.userConfirmed, false)
    const confirmed = s.memory.confirm(candidate.id)
    assert.equal(confirmed.userConfirmed, true)

    const corrected = s.memory.remember({
      content: 'User prefers evening workouts',
      kind: 'preference',
      sourceType: 'user',
      userConfirmed: true,
      supersedesId: candidate.id,
    })
    assert.equal(corrected.supersedesId, candidate.id)

    const old = s.memory.get(candidate.id)
    assert.equal(old.outdated, true, 'superseded item marked outdated')

    // Default search drops outdated items; explicit include brings them back.
    assert.ok(!s.memory.search({ query: 'workouts' }).some((r) => r.item.id === candidate.id))
    assert.ok(s.memory.search({ query: 'workouts', includeOutdated: true }).some((r) => r.item.id === candidate.id))
    assert.ok(s.memory.get(corrected.id))
  } finally {
    s.cleanup()
  }
})

test('memory: restricted sensitivity excluded unless explicitly requested', async () => {
  const s = await makeServiceStack()
  try {
    s.memory.remember({ content: 'Home wifi password is hunter2', sensitivity: 'restricted', sourceType: 'user', userConfirmed: true })
    s.memory.remember({ content: 'Favorite food is ramen', sourceType: 'user', userConfirmed: true })

    assert.equal(s.memory.search({ query: 'password' }).length, 0, 'restricted hidden by default')
    const explicit = s.memory.search({ query: 'password', includeRestricted: true })
    assert.equal(explicit.length, 1)
    assert.equal(explicit[0].item.sensitivity, 'restricted')
  } finally {
    s.cleanup()
  }
})

test('memory: CJK queries match via LIKE fallback (FTS tokenizer limitation)', async () => {
  const s = await makeServiceStack()
  try {
    s.memory.remember({ content: '用户偏好：正式但简洁的导师回复语气', sourceType: 'user', userConfirmed: true })
    const hits = s.memory.search({ query: '导师回复' })
    assert.ok(hits.length >= 1, 'CJK substring query finds the item')
    assert.ok(hits[0].why.includes('FTS'), `why explains match: ${hits[0].why}`)
  } finally {
    s.cleanup()
  }
})

test('memory: delete removes from search; usage provenance records why/when', async () => {
  const s = await makeServiceStack()
  try {
    const m = s.memory.remember({ content: 'Lab meeting notes live in Feishu doc 42', sourceType: 'user', userConfirmed: true })

    s.workflows.register({
      id: 'memory-consumer',
      version: '0.1.0',
      title: 'consumer',
      validateInput: (i) => i,
      steps: [{
        name: 'use-memory',
        execute(input) {
          return input
        },
      }],
    })
    const run = await s.workflows.start('memory-consumer', { note: 'x' })
    s.memory.recordUsage([m.id], run.id, undefined, 'context for run')

    const usage = s.memory.explainRun(run.id)
    assert.equal(usage.length, 1)
    assert.equal(usage[0].memory.content, m.content)
    assert.equal(usage[0].why, 'context for run')
    assert.equal(usage[0].memory.sourceType, 'user')

    s.memory.delete(m.id)
    assert.equal(s.memory.search({ query: 'Feishu' }).filter((r) => r.item.id === m.id).length, 0)
    assert.throws(() => s.memory.get(m.id), /not found/)
    // Usage log stays truthful even after deletion.
    assert.equal(s.memory.explainRun(run.id).length, 0)
  } finally {
    s.cleanup()
  }
})
