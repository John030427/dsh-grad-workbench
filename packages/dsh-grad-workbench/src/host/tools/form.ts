/** Form Assistant tools: inspect/propose, then TWO approval-gated steps. */

import { payloadHash } from '../services/approval-service.ts'
import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

export function makeFormTools(services: HostServices): ToolDefinition[] {
  const inspect = defineGradTool({
    name: 'grad_form_inspect',
    description:
      "Inspect a form URL: field schema, proposed values WITH their source (profile vault / user input needed), and whether a saved recipe matches. Sensitive vault fields are never auto-proposed. Returns a planId used by the fill/submit gates.",
    parameters: { url: { type: 'string', description: 'Form URL', required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        planId: { type: 'string' },
        recipeMatched: { type: 'boolean' },
        proposals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
              source: { type: 'string' },
              needsUserInput: { type: 'boolean' },
            },
            required: ['label', 'source'],
            additionalProperties: false,
          },
        },
      },
      ['ok', 'planId', 'proposals'],
    ),
    async execute(args) {
      const url = (args as { url: string }).url
      const result = await services.forms.inspectAndPropose(url)
      return {
        ok: true,
        planId: result.planId,
        recipeMatched: result.recipeMatched,
        proposals: result.proposals,
      }
    },
  })

  const saveProfileField = defineGradTool({
    name: 'grad_form_save_profile_field',
    description:
      "Save one reusable personal form field into the local profile vault (e.g. 学号/联系电话). Sensitive fields must be marked sensitive — they are never auto-filled.",
    parameters: {
      fieldKey: { type: 'string', required: true },
      label: { type: 'string', required: true },
      value: { type: 'string', required: true },
      sensitivity: { type: 'string', enum: ['normal', 'private', 'restricted'] },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, fieldKey: { type: 'string' }, sensitivity: { type: 'string' } },
      ['ok', 'fieldKey', 'sensitivity'],
    ),
    execute(args) {
      const a = args as { fieldKey: string; label: string; value: string; sensitivity?: 'normal' | 'private' | 'restricted' }
      const f = services.forms.saveProfileField(a)
      return Promise.resolve({ ok: true, fieldKey: f.fieldKey, sensitivity: f.sensitivity })
    },
  })

  // Two gates helper shared by fill/submit tools.
  function gatedExecution(
    args: { planId: string; approvalId: string },
    run: (planId: string, approval: { id: string; status: string; payloadHash: string }, actionPayload: unknown) => Promise<{ ok: boolean }> | { ok: boolean },
  ): Promise<Record<string, unknown>> {
    const approval = services.approvals.get(args.approvalId)
    const actionPayload = { planId: args.planId }
    // The stored approval payload must embed the same plan binding.
    if ((approval.payload as Record<string, unknown> | null)?.planId !== args.planId) {
      throw Object.assign(new Error('approval is bound to a different form plan'), { code: 'APPROVAL_INVALID' })
    }
    const consumed = services.approvals.consume(args.approvalId, actionPayload)
    return Promise.resolve(run(args.planId, { ...consumed, payloadHash: payloadHash(actionPayload) }, actionPayload)) as Promise<
      Record<string, unknown>
    >
  }

  const fill = defineGradTool({
    name: 'grad_form_fill',
    description:
      'FILL gate: after the user approved the form.fill request, consume that approval and fill the form with the proposed values. Submitting requires a SEPARATE later approval.',
    parameters: {
      planId: { type: 'string', required: true },
      approvalId: { type: 'string', description: 'The approved form.fill approval id', required: true },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, filledFields: { type: 'array', items: { type: 'string' } }, error: { type: 'string' } },
      ['ok'],
    ),
    async execute(args) {
      const a = args as { planId: string; approvalId: string }
      const result = await gatedExecution(a, (planId, approval, payload) =>
        services.forms.executeFill(planId, approval, payload),
      )
      return result
    },  })

  const submit = defineGradTool({
    name: 'grad_form_submit',
    description:
      'SUBMIT gate: after a SECOND explicit user approval of form.submit, submit the filled form. Refuses to run before fill completed.',
    parameters: {
      planId: { type: 'string', required: true },
      approvalId: { type: 'string', description: 'The approved form.submit approval id', required: true },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, confirmationRef: { type: 'string' }, error: { type: 'string' } },
      ['ok'],
    ),
    async execute(args) {
      const a = args as { planId: string; approvalId: string }
      const result = await gatedExecution(a, (planId, approval, payload) =>
        services.forms.executeSubmit(planId, approval, payload),
      )
      if (result.ok) {
        // Recipe persistence hook happens in service layer on success paths.
      }
      return result
    },
  })

  return [inspect, saveProfileField, fill, submit]
}
