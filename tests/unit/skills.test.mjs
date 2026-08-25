import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { SkillStudioService } = await import('../../src/host/services/skill-studio.ts')

async function setup() {
  const s = await makeServiceStack()
  // The service stack already satisfies the structural contract; recipes only
  // touch workflows/approvals/memory/artifacts/research/connectors.
  const studio = new SkillStudioService(s)
  return { s, studio }
}

test('skill catalog exposes manifests with contract metadata', async () => {
  const { s, studio } = await setup()
  try {
    const skills = studio.listSkills()
    const ids = skills.map((m) => m.id)
    for (const expected of ['academic-retrieval', 'literature-synthesis', 'feishu-publish-doc', 'memory-note']) {
      assert.ok(ids.includes(expected), `catalog contains ${expected}`)
    }
    const publish = studio.getSkill('feishu-publish-doc')
    assert.equal(publish.externalSideEffect, true, 'publish skill declares external side effect')
    assert.deepEqual(publish.requiredInputs, ['markdown'])
  } finally {
    s.cleanup()
  }
})

test('recipe compiler rejects unknown skills and empty chains', async () => {
  const { s, studio } = await setup()
  try {
    assert.throws(
      () => studio.compose({ title: 'bad', steps: [{ skillId: 'nope' }] }),
      /unknown skill/,
    )
    assert.throws(() => studio.compose({ title: 'empty', steps: [] }), /at least one step/)
  } finally {
    s.cleanup()
  }
})

test('side-effect skill gains an automatic approval gate; recipe runs end-to-end', async () => {
  const { s, studio } = await setup()
  try {
    const result = studio.compose({
      title: 'Note then publish',
      steps: [
        { skillId: 'memory-note', staticInput: { note: 'hello recipe world' } },
        { skillId: 'feishu-publish-doc', staticInput: { markdown: '# hi', title: 'Recipe test' } },
      ],
    })
    assert.ok(result.recipeId.startsWith('recipe-'))

    const run = await s.workflows.start(result.recipeId, {})
    assert.equal(run.status, 'waiting_approval', 'publish step parks behind approval')

    const pending = s.approvals.list({ status: 'pending' })
    assert.equal(pending.length, 1)
    s.approvals.resolve(pending[0].id, 'approved')
    const resumed = await s.workflows.resume(run.id)
    assert.equal(resumed.status, 'completed')

    const steps = s.workflows.getSteps(run.id)
    assert.ok(steps[0].output.memoryId.length > 0, 'memory note created by step 1')
  } finally {
    s.cleanup()
  }
})
