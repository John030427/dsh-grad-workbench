/**
 * Connector layer contracts (plan §Phase 4 / PRD §9).
 * A Connector wraps ONE external system behind capability discovery, preview,
 * and approval-gated execution. Domain code never calls external APIs directly.
 */

import type { ApprovalRequest } from '../../shared/contracts.ts'

export type FeishuAction =
  | { type: 'doc.create'; title: string; markdown: string }
  | { type: 'doc.append'; documentId: string; markdown: string }
  | {
      type: 'im.send'
      receiveIdType: 'open_id' | 'chat_id'
      receiveId: string
      text: string
    }
  | {
      type: 'base.row-insert'
      appToken: string
      tableId: string
      fields: Record<string, string | number | boolean>
    }

export type ConnectorAction = FeishuAction

export interface ConnectorCapabilities {
  actions: Array<ConnectorAction['type']>
  /** Human-readable notes shown on the Connections page. */
  notes?: string
}

export interface ConnectorHealth {
  ok: boolean
  /** Why unhealthy, in user-actionable terms. */
  reason?: string
}

export interface ConnectorPreview {
  summary: string
  destination: string
  /** Markdown card body rendered to the user before approval. */
  card: string
}

export interface ConnectorResult {
  ok: boolean
  /** External reference of the created object (doc url/id/message id). */
  externalRef?: string
  raw?: Record<string, unknown>
  error?: string
}

export interface ExecutionContext {
  /** The already-approved approval binding this exact payload. */
  approval: ApprovalRequest
}

export interface Connector {
  readonly id: string
  readonly label: string
  capabilities(): ConnectorCapabilities
  health(): Promise<ConnectorHealth>
  preview(action: ConnectorAction): Promise<ConnectorPreview>
  /**
   * Perform the side effect. Implementations MUST consume the approval (single
   * use, payload-hash bound) before touching the outside world.
   */
  execute(action: ConnectorAction, ctx: ExecutionContext): Promise<ConnectorResult>
}
