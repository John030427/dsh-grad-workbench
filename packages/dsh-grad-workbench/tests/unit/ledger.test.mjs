import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

async function setup() {
  const s = await makeServiceStack()
  return s
}

test('volunteer hours: duration computed across day boundary in UTC', async () => {
  const s = await setup()
  try {
    // 23:00 → next-day 02:00 = 180 minutes, crossing midnight.
    const entry = s.ledger.add({
      category: 'volunteer',
      startAt: '2026-03-07T23:00:00+08:00',
      endAt: '2026-03-08T02:00:00+08:00',
      organization: '社区图书馆',
    })
    assert.equal(entry.durationMinutes, 180)
  } finally {
    s.cleanup()
  }
})

test('timezone-shifted but identical wall-clock ranges produce the same duration', async () => {
  const s = await setup()
  try {
    const a = s.ledger.add({ category: 'reading', startAt: '2026-05-01T09:00:00+08:00', endAt: '2026-05-01T11:00:00+08:00' })
    const b = s.ledger.add({ category: 'reading', startAt: '2026-05-01T09:00:00Z', endAt: '2026-05-01T11:00:00Z' })
    assert.equal(a.durationMinutes, 120)
    assert.equal(b.durationMinutes, 120, 'offsets normalize to UTC before diffing')
  } finally {
    s.cleanup()
  }
})

test('summary totals group by month and organization', async () => {
  const s = await setup()
  try {
    s.ledger.add({ category: 'volunteer', startAt: '2026-03-01T09:00:00Z', durationMinutes: 120, organization: '图书馆' })
    s.ledger.add({ category: 'volunteer', startAt: '2026-03-15T09:00:00Z', durationMinutes: 60, organization: '图书馆' })
    s.ledger.add({ category: 'volunteer', startAt: '2026-04-02T09:00:00Z', durationMinutes: 90, organization: '敬老院' })
    const total = s.ledger.summary({ category: 'volunteer' })
    assert.equal(total.totalMinutes, 270)
    assert.equal(total.byMonth['2026-03'], 180)
    assert.equal(total.byMonth['2026-04'], 90)
    assert.equal(total.byOrganization['图书馆'], 180)

    const march = s.ledger.summary({ category: 'volunteer', year: 2026 })
    assert.equal(march.count, 3)
  } finally {
    s.cleanup()
  }
})

test('workout: exercises link to one ledger entry; lastWorkout returns newest', async () => {
  const s = await setup()
  try {
    const w1 = s.ledger.addWorkout({
      startAt: '2026-06-01T18:00:00+08:00',
      durationMinutes: 60,
      exercises: [
        { exercise: '深蹲', sets: 5, reps: 5, weightKg: 80 },
        { exercise: '卧推', sets: 5, reps: 5, weightKg: 50 },
      ],
    })
    assert.equal(w1.category, 'fitness')
    assert.equal(w1.sets.length, 2, 'both exercises linked to the same session')

    const w2 = s.ledger.addWorkout({
      startAt: '2026-06-03T19:00:00+08:00',
      durationMinutes: 45,
      exercises: [{ exercise: '硬拉', sets: 3, reps: 5, weightKg: 100 }],
    })

    const last = s.ledger.lastWorkout()
    assert.ok(last)
    assert.equal(last.id, w2.id)
    void w1
  } finally {
    s.cleanup()
  }
})

test('invalid ranges are rejected; CSV export includes evidence refs column', async () => {
  const s = await setup()
  try {
    assert.throws(
      () => s.ledger.add({ category: 'volunteer', startAt: '2026-06-02T10:00:00Z', endAt: '2026-06-02T09:00:00Z', organization: 'x' }),
      /endAt is before startAt/,
    )
    assert.throws(
      () => s.ledger.add({ category: 'volunteer', startAt: '2026-06-02T10:00:00Z', organization: 'x' }),
      /durationMinutes or an endAt/,
    )

    s.ledger.add({
      category: 'volunteer',
      startAt: '2026-06-02T10:00:00Z',
      durationMinutes: 60,
      organization: '图书馆',
      evidenceRefs: ['cert-2026-001'],
    })
    const csv = s.ledger.exportCsv('volunteer')
    assert.ok(csv.startsWith('id,category,startAt'))
    assert.ok(csv.includes('cert-2026-001'), 'evidence refs survive export')
  } finally {
    s.cleanup()
  }
})
