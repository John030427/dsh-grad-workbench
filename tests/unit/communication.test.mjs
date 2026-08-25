import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { CommunicationService, extractCommitments } = await import('../../src/host/services/communication-service.ts')

async function setup() {
  const s = await makeServiceStack()
  const service = new CommunicationService(s.artifacts, s.memory)
  return { s, service }
}

test('classification: progress-update message from advisor', async () => {
  const { s, service } = await setup()
  try {
    const u = service.understand(
      '同学，组会的时候你提到的进展我看了。这周五之前需要你把实验对比补上，尽快发我一版。',
    )
    assert.equal(u.relationship === 'advisor' || u.relationship === 'teacher', true)
    assert.ok(['progress', 'deadline', 'reminder'].includes(u.scenario), `scenario: ${u.scenario}`)
    assert.equal(u.risk === 'medium' || u.risk === 'high', true)
    assert.ok(u.commitments.some((c) => c.due), 'deadline detected')
  } finally {
    s.cleanup()
  }
})

test('commitments extraction pulls explicit obligations with due hints', () => {
  const commitments = extractCommitments('请把修改稿在下周三前发我。另外别忘了提交报销单。谢谢！')
  assert.ok(commitments.length >= 1)
  assert.ok(commitments.some((c) => c.due?.includes('周三')))
})

test('no-invented-progress rule: draft without userFacts contains only placeholders', async () => {
  const { s, service } = await setup()
  try {
    const result = service.draft({ originalText: '导师：研究进展如何？周五组会汇报一下。' })
    for (const draft of result.drafts) {
      assert.ok(draft.markdown.includes('【待填写'), `draft "${draft.tone}" must use placeholders, not invented facts`)
      // The draft must not claim completion on its own.
      assert.ok(!/已完成|已经完成|completed the/i.test(draft.markdown.replace(/【[^】]*】/g, '')))
    }
  } finally {
    s.cleanup()
  }
})

test('user-supplied facts flow into drafts verbatim; memory context carries provenance', async () => {
  const { s, service } = await setup()
  try {
    s.memory.remember({
      content: 'Advisor prefers concise weekly updates with bullet points',
      kind: 'preference',
      sourceType: 'user',
      userConfirmed: true,
    })
    const result = service.draft({
      originalText: '导师：汇报一下本周进展。',
      userFacts: '完成了基线复现；跑了三组消融实验',
    })
    assert.ok(result.drafts.every((d) => d.markdown.includes('完成了基线复现')), 'facts quoted verbatim')
    assert.ok(result.contextUsed.length >= 1, 'advisor-preference memory consulted')
    for (const ctx of result.contextUsed) {
      assert.ok(ctx.why.length > 0, 'each memory usage explains why')
    }
    // Draft saved as artifact.
    const chosen = service.saveDraft({ originalText: 'x', markdown: result.drafts[0].markdown })
    const meta = s.artifacts.getMeta(chosen.artifactId)
    assert.equal(meta.kind, 'communication-draft')
  } finally {
    s.cleanup()
  }
})
