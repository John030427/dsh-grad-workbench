import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { payloadHash } = await import('../../src/host/services/approval-service.ts')

test('approval state machine: pending → approved → consumed, exactly once', async () => {
  const s = await makeServiceStack()
  try {
    const payload = { docTitle: 'AI Agent Memory — Latest 50 Papers', sections: 8 }
    const approval = s.approvals.create({
      actionType: 'feishu.doc.create',
      summary: 'Create Feishu document',
      payload,
      destination: 'Feishu space Demo',
    })
    assert.equal(approval.status, 'pending')

    // Cannot consume before approval.
    assert.throws(() => s.approvals.consume(approval.id, payload), /only "approved" can be consumed/)

    const approved = s.approvals.resolve(approval.id, 'approved')
    assert.equal(approved.status, 'approved')

    // Payload mutation invalidates without consuming.
    assert.throws(() => s.approvals.consume(approval.id, { ...payload, sections: 9 }), /payload changed/)
    assert.equal(s.approvals.get(approval.id).status, 'approved')

    const consumed = s.approvals.consume(approval.id, payload)
    assert.equal(consumed.status, 'consumed')
    assert.ok(consumed.consumedAt)

    // Reuse is blocked; re-resolve is blocked too.
    assert.throws(() => s.approvals.consume(approval.id, payload), /cannot be used/)
    assert.throws(() => s.approvals.resolve(approval.id, 'rejected'), /only "pending" can be resolved/)

    // Hash binding is deterministic and sensitive to content.
    assert.equal(payloadHash(payload), payloadHash({ ...payload }))
    assert.notEqual(payloadHash(payload), payloadHash({ docTitle: 'x' }))
  } finally {
    s.cleanup()
  }
})

test('approval rejection path and listing filters', async () => {
  const s = await makeServiceStack()
  try {
    const a = s.approvals.create({ actionType: 'form.submit', summary: 'Submit scholarship form', payload: {} })
    const b = s.approvals.create({ actionType: 'im.send', summary: 'Send progress update', payload: {} })

    s.approvals.resolve(a.id, 'rejected')
    assert.equal(s.approvals.get(a.id).status, 'rejected')

    const pending = s.approvals.list({ status: 'pending' })
    assert.deepEqual(pending.map((p) => p.id), [b.id])
  } finally {
    s.cleanup()
  }
})

test('expired approvals cannot be resolved', async () => {
  const s = await makeServiceStack()
  try {
    const a = s.approvals.create({
      actionType: 'demo.external_write',
      summary: 'short-lived',
      payload: {},
      ttlMs: -1000, // already expired
    })
    assert.equal(a.status, 'expired') // creation read sweeps pending → expired
    assert.throws(() => s.approvals.resolve(a.id, 'approved'), /only "pending" can be resolved/)
  } finally {
    s.cleanup()
  }
})
