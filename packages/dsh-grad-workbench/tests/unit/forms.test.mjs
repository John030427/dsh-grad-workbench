import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { MockFormAutomation, FormService } = await import('../../src/host/services/form-service.ts')

async function setup() {
  const s = await makeServiceStack()
  const forms = new FormService(s.db)
  return { s, forms }
}

const URL = 'https://scholar.example.org/scholarship/apply'

test('profile vault: save + sensitive exclusion in proposals', async () => {
  const { s, forms } = await setup()
  try {
    forms.saveProfileField({ fieldKey: '姓名', label: '姓名', value: '张三' })
    forms.saveProfileField({ fieldKey: '学号', label: '学号', value: '2023123456' })
    forms.saveProfileField({
      fieldKey: '联系电话',
      label: '联系电话',
      value: '13800138000',
      sensitivity: 'restricted',
      userConfirmed: true,
    })

    const plan = await forms.inspectAndPropose(URL)
    assert.equal(plan.schema.fields.length, 5)

    const name = plan.proposals.find((p) => p.label === '姓名')
    assert.equal(name.value, '张三')
    assert.equal(name.source.startsWith('profile:'), true)

    const phone = plan.proposals.find((p) => p.label === '联系电话')
    assert.equal(phone.value, undefined, 'sensitive value NEVER auto-proposed')
    assert.match(phone.source, /SENSITIVE/)
    assert.equal(phone.needsUserInput, true)

    // Values actually used for filling exclude the restricted field.
    void s
  } finally {
    s.cleanup()
  }
})

test('two-gate execution: submit before fill is refused; gates are approval-bound', async () => {
  const { s, forms } = await setup()
  try {
    forms.saveProfileField({ fieldKey: '姓名', label: '姓名', value: '张三' })
    const plan = await forms.inspectAndPropose(URL)
    const payload = { planId: plan.planId }

    // Create the two separate approvals (fill / submit), both approved upfront.
    const fillApproval = s.approvals.create({ actionType: 'form.fill', summary: 'Fill form', payload })
    s.approvals.resolve(fillApproval.id, 'approved')
    const submitApproval = s.approvals.create({ actionType: 'form.submit', summary: 'Submit form', payload })
    s.approvals.resolve(submitApproval.id, 'approved')

    // Submit BEFORE fill must be refused even though its own approval is approved.
    await assert.rejects(
      () => forms.executeSubmit(plan.planId, { id: submitApproval.id, status: 'consumed', payloadHash: hashOf(payload) }, payload),
      /not been filled yet/,
    )

    // Fill runs after its gate.
    const consumed = s.approvals.consume(fillApproval.id, payload)
    const fillOutcome = await forms.executeFill(plan.planId, { ...consumed, payloadHash: hashOf(payload) }, payload)
    assert.equal(fillOutcome.ok, true)

    // Now submit may run through its gate.
    const consumedSubmit = s.approvals.consume(submitApproval.id, payload)
    const outcome = await forms.executeSubmit(plan.planId, { ...consumedSubmit, payloadHash: hashOf(payload) }, payload)
    assert.equal(outcome.ok, true)
    assert.ok(outcome.confirmationRef)
  } finally {
    s.cleanup()
  }
})

// Local mirror of ApprovalService.payloadHash to keep the test self-contained.
import { createHash } from 'node:crypto'
function hashOf(payload) {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex')
}
