/**
 * Connector native-agent tools. Publishes are TWO-phase: prepare creates a
 * pending approval with the exact action payload; execute runs only after the
 * user approved AND the gate consumed the approval.
 */

import { isGradError } from '../../shared/errors.ts'
import { payloadHash } from '../services/approval-service.ts'
import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'
import type { ConnectorAction } from '../connectors/types.ts'

export function makeConnectorTools(services: HostServices): ToolDefinition[] {
  const list = defineGradTool({
    name: 'grad_connector_list',
    description:
      'List configured external connectors (Feishu/Lark first), their supported actions, health and setup hints.',
    parameters: {},
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        connectors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              healthy: { type: 'boolean' },
              reason: { type: 'string' },
              actions: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'label'],
            additionalProperties: false,
          },
        },
      },
      ['ok', 'connectors'],
    ),
    async execute() {
      const healths = await services.connectors.healthAll()
      const byId = new Map(healths.map((h) => [h.id, h.health]))
      return {
        ok: true,
        connectors: services.connectors.list().map((c) => ({
          id: c.id,
          label: c.label,
          actions: c.actions,
          healthy: byId.get(c.id)?.ok ?? false,
          ...(byId.get(c.id)?.reason ? { reason: byId.get(c.id)!.reason } : {}),
        })),
      }
    },
  })

  const preview = defineGradTool({
    name: 'grad_feishu_preview',
    description:
      'Render a human-readable preview card for a Feishu publish action WITHOUT any state change. Always show this to the user before preparing an approval.',
    parameters: {
      actionType: {
        type: 'string',
        enum: ['doc.create', 'doc.append', 'im.send', 'base.row-insert'],
        description: 'Which Feishu action to preview',
        required: true,
      },
      title: { type: 'string', description: 'doc.create: document title' },
      markdown: { type: 'string', description: 'doc.create/doc.append: Markdown content' },
      documentId: { type: 'string', description: 'doc.append: target doc id' },
      receiveIdType: { type: 'string', enum: ['open_id', 'chat_id'], description: 'im.send' },
      receiveId: { type: 'string', description: 'im.send: target user/chat id' },
      text: { type: 'string', description: 'im.send: message text' },
      appToken: { type: 'string', description: 'base.row-insert: Base app token' },
      tableId: { type: 'string', description: 'base.row-insert: table id' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, summary: { type: 'string' }, destination: { type: 'string' }, card: { type: 'string' } },
      ['ok', 'summary', 'destination', 'card'],
    ),
    async execute(args) {
      const action = actionFromArgs(args)
      const preview = await services.connectors.require('feishu').preview(action)
      return { ok: true, summary: preview.summary, destination: preview.destination, card: preview.card }
    },
  })

  const prepare = defineGradTool({
    name: 'grad_feishu_prepare_publish',
    description:
      'Create a PENDING approval request for a Feishu publish action. Show the user the preview and let them decide; nothing is sent until grad_feishu_execute_publish runs after an explicit approval.',
    parameters: {
      actionType: {
        type: 'string',
        enum: ['doc.create', 'doc.append', 'im.send', 'base.row-insert'],
        required: true,
      },
      title: { type: 'string' },
      markdown: { type: 'string' },
      documentId: { type: 'string' },
      receiveIdType: { type: 'string', enum: ['open_id', 'chat_id'] },
      receiveId: { type: 'string' },
      text: { type: 'string' },
      appToken: { type: 'string' },
      tableId: { type: 'string' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, approvalId: { type: 'string' }, status: { type: 'string' }, hint: { type: 'string' } },
      ['ok', 'approvalId', 'status'],
    ),
    async execute(args) {
      const action = actionFromArgs(args)
      const connectorPreview = await services.connectors.require('feishu').preview(action)
      const approval = services.approvals.create({
        actionType: `feishu.${action.type}`,
        summary: connectorPreview.summary,
        payload: action,
        destination: connectorPreview.destination,
      })
      return {
        ok: true,
        approvalId: approval.id,
        status: approval.status,
        hint: 'Show the preview card to the user. After they explicitly approve, resolve via grad_approval_resolve then run grad_feishu_execute_publish.',
      }
    },
  })

  const executePublish = defineGradTool({
    name: 'grad_feishu_execute_publish',
    description:
      'Execute an APPROVED Feishu publish. Requires the approval to be already resolved as approved (consumed here); refuses mutated payloads, re-used approvals and duplicate publishes durably.',
    parameters: { approvalId: { type: 'string', required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        published: { type: 'boolean' },
        externalRef: { type: 'string' },
        error: { type: 'string' },
      },
      ['ok', 'published'],
    ),
    async execute(args) {
      const approvalId = (args as { approvalId: string }).approvalId
      const approval = services.approvals.get(approvalId)
      const action = approval.payload as ConnectorAction
      // Consume here (single-use gate for the direct-tool path).
      const consumed = services.approvals.consume(approvalId, action)
      try {
        const result = await services.connectors
          .require('feishu')
          .execute(action, { approval: { ...consumed, payloadHash: payloadHash(action) } })
        return {
          ok: result.ok,
          published: result.ok,
          ...(result.externalRef ? { externalRef: result.externalRef } : {}),
          ...(result.error ? { error: result.error } : {}),
        }
      } catch (err) {
        if (isGradError(err)) return { ok: false, published: false, error: err.message }
        throw err
      }
    },
  })

  function actionFromArgs(args: unknown): ConnectorAction {
    const a = args as Record<string, unknown>
    switch (a.actionType ?? a.type) {
      case 'doc.create': {
        if (typeof a.title !== 'string' || typeof a.markdown !== 'string') {
          throw Object.assign(new Error('doc.create requires title and markdown'), { code: 'INVALID_INPUT' })
        }
        return { type: 'doc.create', title: a.title, markdown: a.markdown }
      }
      case 'doc.append':
        return { type: 'doc.append', documentId: String(a.documentId), markdown: String(a.markdown ?? '') }
      case 'im.send':
        return {
          type: 'im.send',
          receiveIdType: a.receiveIdType === 'chat_id' ? 'chat_id' : 'open_id',
          receiveId: String(a.receiveId),
          text: String(a.text ?? ''),
        }
      case 'base.row-insert':
        return {
          type: 'base.row-insert',
          appToken: String(a.appToken),
          tableId: String(a.tableId),
          fields: (a.fields as Record<string, string | number | boolean>) ?? {},
        }
      default:
        throw Object.assign(new Error(`unknown feishu action type: ${String(a.actionType)}`), { code: 'INVALID_INPUT' })
    }
  }

  return [list, preview, prepare, executePublish]
}
