import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { ECHO_DEMO_WORKFLOW } = await import('../../src/host/workflows.ts')

async function setup() {
  const s = await makeServiceStack()
  s.workflows.register(ECHO_DEMO_WORKFLOW)
  return s
}

test('echo-demo: start parks on approval; approving completes with artifact', async () => {
  const s = await setup()
  try {
    const run = await s.workflows.start('echo-demo', { message: '  hello graduate os  ' })
    assert.equal(run.status, 'waiting_approval', 'gated step must park the run')

    const steps = s.workflows.getSteps(run.id)
    assert.equal(steps[0].status, 'completed')
    assert.deepEqual(steps[0].output, { normalized: 'hello graduate os', length: 17 })

    const pending = s.approvals.list({ status: 'pending' })
    assert.equal(pending.length, 1)
    assert.equal(pending[0].actionType, 'demo.external_write')
    assert.equal(pending[0].workflowRunId, run.id)

    // Approving resumes the run to completion and consumes the approval.
    s.approvals.resolve(pending[0].id, 'approved')
    const resumed = await s.workflows.resume(run.id)
    assert.equal(resumed.status, 'completed')
    assert.equal(resumed.outputRefs.length, 1)

    const consumed = s.approvals.list({ status: 'consumed' })
    assert.equal(consumed.length, 1)

    const artifact = s.artifacts.getMeta(resumed.outputRefs[0])
    const { text } = s.artifacts.readText(artifact.id)
    assert.ok(text.includes('hello graduate os'))

    // Steps recorded a tool call from the gated step.
    const finalSteps = s.workflows.getSteps(run.id)
    assert.equal(finalSteps[1].toolCalls.length, 1)
    assert.equal(finalSteps[1].toolCalls[0].tool, 'artifact.write_markdown')
  } finally {
    s.cleanup()
  }
})

test('echo-demo: rejecting the approval fails the run without side effects', async () => {
  const s = await setup()
  try {
    const before = s.artifacts.list().length
    const run = await s.workflows.start('echo-demo', { message: 'do not publish' })
    const pending = s.approvals.list({ status: 'pending' })
    s.approvals.resolve(pending[0].id, 'rejected')
    const resumed = await s.workflows.resume(run.id)

    assert.equal(resumed.status, 'failed')
    assert.match(resumed.error ?? '', /approval rejected/)
    const steps = s.workflows.getSteps(run.id)
    assert.equal(steps[1].status, 'skipped', 'gated step never ran')
    assert.equal(s.artifacts.list().length, before, 'no artifact created after rejection')
  } finally {
    s.cleanup()
  }
})

test('echo-demo: invalid input is rejected before any run row exists', async () => {
  const s = await setup()
  try {
    assert.throws(() => s.workflows.start('echo-demo', { wrong: true }), /requires input/)
  } finally {
    s.cleanup()
  }
})

test('unknown workflow surfaces actionable error', async () => {
  const s = await setup()
  try {
    assert.throws(() => s.workflows.start('missing-workflow', {}), /not found/)
  } finally {
    s.cleanup()
  }
})
