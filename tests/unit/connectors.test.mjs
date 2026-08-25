import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { FeishuCliConnector, buildArgv } = await import('../../src/host/connectors/feishu.ts')

const DOC_ACTION = {
  type: 'doc.create',
  title: 'AI Agent Memory — Latest 50 Papers',
  markdown: '# Report\n\n- theme clusters\n- reading list',
}

async function stackWithConnector() {
  const s = await makeServiceStack()
  s.calls = []
  const connector = new FeishuCliConnector(s.db, {
    executor: async (argv) => {
      s.calls.push(argv)
      return { code: 0, stdout: '{"url":"https://example.feishu.cn/doc/abc123"}' }
    },
  })
  return { s, connector }
}

test('execute refuses approvals that are not consumed by the gate', async () => {
  const { s, connector } = await stackWithConnector()
  try {
    const pending = s.approvals.create({ actionType: 'feishu.doc.create', summary: 'publish', payload: DOC_ACTION })
    await assert.rejects(() => connector.execute(DOC_ACTION, { approval: pending }), /gate not run/)
  } finally {
    s.cleanup()
  }
})

test('execute rejects a mutated payload even when an approval exists', async () => {
  const { s, connector } = await stackWithConnector()
  try {
    const approval = s.approvals.create({ actionType: 'feishu.doc.create', summary: 'publish', payload: DOC_ACTION })
    s.approvals.resolve(approval.id, 'approved')
    const mutatedAction = { ...DOC_ACTION, title: 'CHANGED after approval' }
    const consumed = s.approvals.consume(approval.id, DOC_ACTION)
    await assert.rejects(() => connector.execute(mutatedAction, { approval: consumed }), /hash does not match/)
  } finally {
    s.cleanup()
  }
})

test('happy path: approved → consumed → executed exactly once; duplicates blocked', async () => {
  const { s, connector } = await stackWithConnector()
  try {
    const approval = s.approvals.create({
      actionType: 'feishu.doc.create',
      summary: 'Publish report to Feishu',
      payload: DOC_ACTION,
    })
    s.approvals.resolve(approval.id, 'approved')
    const consumed = s.approvals.consume(approval.id, DOC_ACTION)

    const result = await connector.execute(DOC_ACTION, { approval: consumed })
    assert.equal(result.ok, true)
    assert.equal(result.externalRef, 'https://example.feishu.cn/doc/abc123')
    const publishCalls = s.calls.filter((a) => a[1] === 'doc')
    assert.equal(publishCalls.length, 1)
    assert.deepEqual(publishCalls[0].slice(0, 3), ['lark', 'doc', 'create'])

    await assert.rejects(() => connector.execute(DOC_ACTION, { approval: consumed }), /already been executed/)
    const publishCallsAfter = s.calls.filter((a) => a[1] === 'doc')
    assert.equal(publishCallsAfter.length, 1, 'no second CLI invocation')

    // The event ledger records the publish with its approval binding.
    const events = s.db.prepare('SELECT approval_id, ok FROM connector_events').all()
    assert.equal(events.length, 1)
    assert.equal(events[0].approval_id, approval.id)
    assert.equal(events[0].ok, 1)
  } finally {
    s.cleanup()
  }
})

test('health reports actionable setup hint when the CLI is missing', async () => {
  const s = await makeServiceStack()
  try {
    const failingExecutor = async () => ({ code: -1, stdout: '', stderr: 'spawn lark ENOENT' })
    const connector = new FeishuCliConnector(s.db, { executor: failingExecutor })
    const health = await connector.health()
    assert.equal(health.ok, false)
    assert.match(health.reason, /Install it and authenticate/)
  } finally {
    s.cleanup()
  }
})

test('buildArgv routes each action type; large content uses temp file', () => {
  const small = buildArgv({ type: 'im.send', receiveIdType: 'chat_id', receiveId: 'oc_1', text: 'hello' }, 'lark')
  assert.deepEqual(small.argv.slice(0, 4), ['lark', 'im', 'send', '--receive-id-type'])

  const big = buildArgv({ type: 'doc.create', title: 'T', markdown: 'x'.repeat(3000) }, 'lark')
  assert.ok(big.argv.includes('--content-file'), 'large content goes through temp file')
  big.cleanup?.()

  const row = buildArgv(
    { type: 'base.row-insert', appToken: 'app1', tableId: 'tbl1', fields: { name: 'n' } },
    'lark',
  )
  assert.deepEqual(row.argv.slice(0, 4), ['lark', 'base', 'record', 'create'])
})
