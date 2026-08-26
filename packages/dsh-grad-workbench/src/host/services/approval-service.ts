/**
 * ApprovalService — every external side effect must pass through here.
 *
 * States: pending → approved|rejected → consumed (approved only), or expired.
 * Invariants (tested):
 *  - an approval binds to a payload hash; consuming with a different payload fails;
 *  - a consumed approval cannot be reused;
 *  - expired approvals cannot be resolved or consumed.
 */

import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { ApprovalRequest, ApprovalStatus } from '../../shared/contracts.ts'
import { errors } from '../../shared/errors.ts'

export interface CreateApprovalInput {
  actionType: string
  summary: string
  payload: unknown
  destination?: string
  previewArtifactId?: string
  workflowRunId?: string
  stepId?: string
  ttlMs?: number
}

export function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex')
}

export class ApprovalService {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  create(input: CreateApprovalInput): ApprovalRequest {
    const id = crypto.randomUUID()
    const now = new Date()
    const expiresAt = input.ttlMs ? new Date(now.getTime() + input.ttlMs).toISOString() : null
    this.db
      .prepare(
        `INSERT INTO approval_requests
           (id, action_type, summary, payload, payload_hash, destination, preview_artifact_id,
            workflow_run_id, step_id, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(
        id,
        input.actionType,
        input.summary,
        JSON.stringify(input.payload ?? null),
        payloadHash(input.payload),
        input.destination ?? null,
        input.previewArtifactId ?? null,
        input.workflowRunId ?? null,
        input.stepId ?? null,
        now.toISOString(),
        expiresAt,
      )
    return this.get(id)
  }

  private rowToApproval(row: Record<string, unknown>): ApprovalRequest {
    return {
      id: row.id as string,
      actionType: row.action_type as string,
      summary: row.summary as string,
      payload: JSON.parse((row.payload as string) ?? 'null'),
      payloadHash: row.payload_hash as string,
      destination: (row.destination as string) ?? undefined,
      previewArtifactId: (row.preview_artifact_id as string) ?? undefined,
      workflowRunId: (row.workflow_run_id as string) ?? undefined,
      stepId: (row.step_id as string) ?? undefined,
      status: row.status as ApprovalStatus,
      createdAt: row.created_at as string,
      expiresAt: (row.expires_at as string) ?? undefined,
      resolvedAt: (row.resolved_at as string) ?? undefined,
      consumedAt: (row.consumed_at as string) ?? undefined,
      resolvedBy: (row.resolved_by as 'user' | 'system') ?? undefined,
    }
  }

  private fetchRow(id: string): Record<string, unknown> {
    const row = this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    if (!row) throw errors.notFound('approval request', id)
    // Lazy expiration sweep.
    if (
      row.status === 'pending' &&
      typeof row.expires_at === 'string' &&
      Date.parse(row.expires_at) < Date.now()
    ) {
      this.db
        .prepare("UPDATE approval_requests SET status = 'expired' WHERE id = ? AND status = 'pending'")
        .run(id)
      row.status = 'expired'
    }
    return row
  }

  get(id: string): ApprovalRequest {
    return this.rowToApproval(this.fetchRow(id))
  }

  list(filter: { status?: ApprovalStatus; workflowRunId?: string; limit?: number } = {}): ApprovalRequest[] {
    const clauses: string[] = []
    const params: Array<string | number> = []
    if (filter.status) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    if (filter.workflowRunId) {
      clauses.push('workflow_run_id = ?')
      params.push(filter.workflowRunId)
    }
    params.push(filter.limit ?? 50)
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.db
      .prepare(`SELECT * FROM approval_requests ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(...params) as Array<Record<string, unknown>>
    return rows.map((r) => this.rowToApproval(r))
  }

  /** pending → approved | rejected */
  resolve(id: string, decision: 'approved' | 'rejected', by: 'user' | 'system' = 'user'): ApprovalRequest {
    const current = this.get(id)
    if (current.status !== 'pending') {
      throw errors.approvalInvalid(id, `status is "${current.status}", only "pending" can be resolved`)
    }
    this.db
      .prepare(
        `UPDATE approval_requests SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ? AND status = 'pending'`,
      )
      .run(decision, new Date().toISOString(), by, id)
    return this.get(id)
  }

  /**
   * approved → consumed. The caller must present the exact payload the approval
   * was created for; a mutated payload invalidates the approval without consuming it.
   * Returns the stored approval on success so the caller can proceed exactly once.
   */
  consume(id: string, presentedPayload: unknown): ApprovalRequest {
    const current = this.get(id)
    if (current.status === 'expired') throw errors.approvalInvalid(id, 'approval expired')
    if (current.status !== 'approved') {
      throw errors.approvalInvalid(id, `status is "${current.status}", only "approved" can be consumed`)
    }
    if (payloadHash(presentedPayload) !== current.payloadHash) {
      throw errors.approvalInvalid(id, 'payload changed after approval — approval invalidated, create a new one')
    }
    this.db
      .prepare(`UPDATE approval_requests SET status = 'consumed', consumed_at = ? WHERE id = ? AND status = 'approved'`)
      .run(new Date().toISOString(), id)
    return this.get(id)
  }
}
