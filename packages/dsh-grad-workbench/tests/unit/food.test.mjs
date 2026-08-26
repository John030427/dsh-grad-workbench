import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

test('food: save → unresolved; confirm requires user place info; pin survives', async () => {
  const s = await makeServiceStack()
  try {
    const r = s.food.save({ name: '老王烤肉', note: '小红书看到的', sourceText: '这家烤肉店绝了', cuisine: '烤肉' })
    assert.equal(r.status, 'unresolved')
    assert.equal(r.sourceTexts[0], '这家烤肉店绝了', 'source text retained')

    // Confirm without any place info is rejected.
    assert.throws(() => s.food.confirm(r.id), /requires an address or coordinates/)

    const confirmed = s.food.confirm(r.id, { address: '大学城南路 88 号' })
    assert.equal(confirmed.status, 'want_to_try')
    assert.equal(confirmed.address, '大学城南路 88 号')

    const visited = s.food.setStatus(r.id, 'visited', 5)
    assert.equal(visited.status, 'visited')
    assert.ok(visited.lastVisitedAt)

    s.food.delete(r.id)
    assert.throws(() => s.food.get(r.id), /not found/)
  } finally {
    s.cleanup()
  }
})

test('food: ambiguous input never auto-confirms (no provider → unresolved)', async () => {
  const s = await makeServiceStack()
  try {
    // Simulate the screenshot-capture path: name extracted from text.
    s.food.save({ name: '那家川菜馆' })
    const all = s.food.list()
    assert.equal(all.length, 1)
    assert.equal(all[0].status, 'unresolved', 'no silent pin without user confirmation')
  } finally {
    s.cleanup()
  }
})

test('food: list filters by status and query', async () => {
  const s = await makeServiceStack()
  try {
    const a = s.food.save({ name: 'Sushi Ito', cuisine: 'sushi' })
    s.food.save({ name: '兰州拉面', cuisine: '面食' })
    s.food.confirm(a.id, { address: 'somewhere 1-2' })

    assert.equal(s.food.list({ status: 'want_to_try' }).length, 1)
    assert.equal(s.food.list({ status: 'unresolved' }).length, 1)
    assert.equal(s.food.list({ query: 'sushi' }).length, 1)
    assert.equal(s.food.list({ query: '拉面' }).length, 1)
    assert.equal(s.food.list().length, 2)
  } finally {
    s.cleanup()
  }
})
