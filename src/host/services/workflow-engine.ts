/**
 * WorkflowEngine — sequential typed workflows with approval gates.
 *
 * Run lifecycle: queued → running → waiting_approval ⇄ running → completed|failed.
 * A step that declares `requiresApprovals` pauses the run BEFORE executing:
 * approvals are created once, the run parks in waiting_approval, and driving
 * resumes when every approval for the run is approved (consumed automatically,
 * exactly once, right before the gated step body runs). A rejected approval
 * fails the run without executing the gated step.
 */

import type { DatabaseSync } from 'node:sqlite'
import type { ModelDecision, SourceRef, WorkflowRun, WorkflowRunStatus } from '../../shared/contracts.ts'
import { errors } from '../../shared/errors.ts'
import type { ApprovalService, CreateApprovalInput } from './approval-service.ts'
import type { ArtifactStore } from './artifact-store.ts'

/** Structural artifact face a step may use; `put` auto-attaches to the run. */
export interface StepArtifactStore {
  put(input: {
    kind: import('../../shared/contracts.ts').ArtifactKind
    mediaType: string
    bytes: string | Uint8Array
    workflowRunId?: string
    sourceRefs?: import('../../shared/contracts.ts').SourceRef[]
    createdAt?: string
  }): import('../../shared/contracts.ts').ArtifactRef
  getMeta(id: string): import('../../shared/contracts.ts').ArtifactRef
  readText(id: string): { meta: import('../../shared/contracts.ts').ArtifactRef; text: string }
  list(filter?: { kind?: import('../../shared/contracts.ts').ArtifactKind; workflowRunId?: string; limit?: number }): Array<import('../../shared/contracts.ts').ArtifactRef>
  delete(id: string): void
}

export interface WorkflowStepContext {
  runId: string
  stepId: string
  artifacts: StepArtifactStore
  /** Record a notable tool invocation performed inside the step. */
  recordToolCall(tool: string, ok: boolean): void
}

export interface WorkflowStepDef {
  name: string
  skillId?: string
  /** Approval requests created when execution first reaches this step. */
  requiresApprovals?(input: unknown): Array<CreateApprovalInput>
  execute(input: unknown, ctx: WorkflowStepContext): Promise<unknown> | unknown
}

export interface WorkflowDefinition {
  id: string
  version: string
  title: string
  description?: string
  /** Validate/normalize raw input; throw GradError('INVALID_INPUT') on violation. */
  validateInput(input: unknown): unknown
  steps: WorkflowStepDef[]
}

interface StepRow {
  id: string
  run_id: string
  skill_id: string | null
  skill_version: string | null
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input: string | null
  output: string | null
  tool_calls: string
  started_at: string | null
  finished_at: string | null
  failure: string | null
}

export class WorkflowEngine {
  private readonly definitions = new Map<string, WorkflowDefinition>()
  private readonly active = new Set<string>()
  private readonly db: DatabaseSync
  private readonly approvals: ApprovalService
  private readonly artifacts: ArtifactStore

  constructor(db: DatabaseSync, approvals: ApprovalService, artifacts: ArtifactStore) {
    this.db = db
    this.approvals = approvals
    this.artifacts = artifacts
  }

  register(def: WorkflowDefinition): () => void {
    this.definitions.set(def.id, def)
    return () => this.definitions.delete(def.id)
  }

  listWorkflows(): Array<{ id: string; version: string; title: string; steps: number }> {
    return [...this.definitions.values()].map((d) => ({
      id: d.id,
      version: d.version,
      title: d.title,
      steps: d.steps.length,
    }))
  }

  getDefinition(id: string): WorkflowDefinition {
    const def = this.definitions.get(id)
    if (!def) throw errors.notFound('workflow', id)
    return def
  }

  // ── run lifecycle ─────────────────────────────────────────────────────────

  start(workflowId: string, rawInput: unknown, sessionId?: string): Promise<WorkflowRun> {
    const def = this.getDefinition(workflowId)
    const input = def.validateInput(rawInput)
    const runId = crypto.randomUUID()
    const now = new Date().toISOString()

    const tx = this.begin()
    try {
      this.db
        .prepare(
          `INSERT INTO workflow_runs
             (id, workflow_id, workflow_version, started_at, status, input_snapshot, output_refs, model_decisions, source_refs, approval_refs, session_id)
           VALUES (?, ?, ?, ?, 'queued', ?, '[]', '[]', '[]', '[]', ?)`,
        )
        .run(runId, def.id, def.version, now, JSON.stringify(input ?? null), sessionId ?? null)

      let prevOutput: string | null = JSON.stringify(input ?? null)
      for (const step of def.steps) {
        const stepId = crypto.randomUUID()
        this.db
          .prepare(
            `INSERT INTO workflow_steps (id, run_id, skill_id, skill_version, name, status, input, tool_calls)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, '[]')`,
          )
          .run(stepId, runId, step.skillId ?? null, def.version, step.name, prevOutput)
        prevOutput = null
      }
      tx.commit()
    } catch (err) {
      tx.rollback()
      throw err
    }

    // Drive inline: MVP workflows are fast local operations; the returned
    // snapshot already reflects parking (waiting_approval) or completion.
    return this.drive(runId).then(() => this.getRun(runId))
  }

  /**
   * Continue a parked run. Safe to call repeatedly (idempotent while waiting).
   * Returns the run snapshot AFTER an attempt to advance it.
   */
  async resume(runId: string): Promise<WorkflowRun> {
    await this.drive(runId)
    return this.getRun(runId)
  }

  private async drive(runId: string): Promise<void> {
    if (this.active.has(runId)) return
    this.active.add(runId)
    try {
      await this.loop(runId)
    } finally {
      this.active.delete(runId)
    }
  }

  private async loop(runId: string): Promise<void> {
    const def = this.definitionForRun(runId)
    const steps = this.stepRows(runId)

    // A rejected approval kills the run before any gated work happens.
    const rejected = this.approvals.list({ workflowRunId: runId, limit: 100 }).find((a) => a.status === 'rejected')
    if (rejected) {
      this.skipRemaining(runId)
      this.setStatus(runId, 'failed', `approval rejected: ${rejected.summary}`)
      return
    }
    const stillPending = this.approvals.list({ workflowRunId: runId, status: 'pending', limit: 1 })
    if (stillPending.length > 0) {
      this.setStatus(runId, 'waiting_approval')
      return
    }

    this.setStatus(runId, 'running')

    let previousOutput: unknown
    for (let i = 0; i < steps.length; i++) {
      const stepRow = steps[i]!
      if (stepRow.status === 'completed' || stepRow.status === 'skipped') {
        previousOutput = stepRow.output ? JSON.parse(stepRow.output) : undefined
        continue
      }
      if (stepRow.status === 'failed') return // already terminal
      const stepDef = def.steps[i]!

      // Create this step's approvals once, then park.
      if (stepDef.requiresApprovals) {
        const existing = this.approvals.list({ workflowRunId: runId, limit: 100 })
        const mine = existing.filter((a) => a.stepId === stepRow.id)
        if (mine.length === 0) {
          const stepInput = stepRow.input ? JSON.parse(stepRow.input) : previousOutput
          for (const spec of stepDef.requiresApprovals(stepInput)) {
            this.approvals.create({ ...spec, workflowRunId: runId, stepId: stepRow.id })
          }
          this.setStatus(runId, 'waiting_approval')
          return
        }
      }

      // Consume approved approvals bound to this step (exactly-once side effects).
      const approvedForStep = this.approvals.list({ workflowRunId: runId, limit: 100 }).filter(
        (a) => a.stepId === stepRow.id && a.status === 'approved',
      )
      for (const approval of approvedForStep) {
        this.approvals.consume(approval.id, approval.payload)
      }

      const stepInput = stepRow.input ? JSON.parse(stepRow.input) : previousOutput
      const startedAt = new Date().toISOString()
      this.db.prepare("UPDATE workflow_steps SET status = 'running', started_at = ? WHERE id = ?").run(startedAt, stepRow.id)

      const toolCalls: Array<{ tool: string; at: string; ok: boolean }> = []
      const createdArtifacts: string[] = []
      const stepArtifacts: StepArtifactStore = {
        put: (input) => {
          const ref = this.artifacts.put({ ...input, workflowRunId: input.workflowRunId ?? runId })
          createdArtifacts.push(ref.id)
          return ref
        },
        getMeta: (id) => this.artifacts.getMeta(id),
        readText: (id) => this.artifacts.readText(id),
        list: (filter) => this.artifacts.list(filter),
        delete: (id) => this.artifacts.delete(id),
      }
      try {
        const output = await stepDef.execute(stepInput, {
          runId,
          stepId: stepRow.id,
          artifacts: stepArtifacts,
          recordToolCall: (tool, ok) => toolCalls.push({ tool, at: new Date().toISOString(), ok }),
        })
        for (const artifactId of createdArtifacts) {
          this.attachArtifact(runId, artifactId)
        }
        const finishedAt = new Date().toISOString()
        this.db
          .prepare("UPDATE workflow_steps SET status = 'completed', output = ?, finished_at = ?, tool_calls = ? WHERE id = ?")
          .run(JSON.stringify(output ?? null), finishedAt, JSON.stringify(toolCalls), stepRow.id)
        previousOutput = output
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this.db
          .prepare("UPDATE workflow_steps SET status = 'failed', failure = ?, finished_at = ?, tool_calls = ? WHERE id = ?")
          .run(message, new Date().toISOString(), JSON.stringify(toolCalls), stepRow.id)
        this.skipRemainingAfter(runId, stepRow.id)
        this.setStatus(runId, 'failed', message)
        return
      }
    }

    this.setStatus(runId, 'completed')
  }

  // ── queries ───────────────────────────────────────────────────────────────

  getRun(id: string): WorkflowRun {
    const row = this.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw errors.notFound('workflow run', id)
    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      workflowVersion: row.workflow_version as string,
      startedAt: row.started_at as string,
      finishedAt: (row.finished_at as string) ?? undefined,
      status: row.status as WorkflowRunStatus,
      inputSnapshot: JSON.parse((row.input_snapshot as string) ?? 'null'),
      outputRefs: JSON.parse((row.output_refs as string) ?? '[]'),
      modelDecisions: JSON.parse((row.model_decisions as string) ?? '[]'),
      sourceRefs: JSON.parse((row.source_refs as string) ?? '[]'),
      approvalRefs: (row.approval_refs as string) ? JSON.parse(row.approval_refs as string) : [],
      sessionId: (row.session_id as string) ?? undefined,
      error: (row.error as string) ?? undefined,
    }
  }

  listRuns(filter: { status?: WorkflowRunStatus; limit?: number } = {}): WorkflowRun[] {
    const clauses: string[] = []
    const params: Array<string | number> = []
    if (filter.status) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    params.push(filter.limit ?? 25)
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.db
      .prepare(`SELECT id FROM workflow_runs ${where} ORDER BY started_at DESC LIMIT ?`)
      .all(...params) as Array<{ id: string }>
    return rows.map((r) => this.getRun(r.id))
  }

  getSteps(runId: string): Array<Record<string, unknown>> {
    const rows = this.db
      .prepare('SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY rowid')
      .all(runId) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r.id,
      runId: r.run_id,
      skillId: r.skill_id ?? undefined,
      skillVersion: r.skill_version ?? undefined,
      name: r.name,
      status: r.status,
      input: safeParse(r.input as string | null),
      output: safeParse(r.output as string | null),
      toolCalls: safeParse((r.tool_calls as string) ?? '[]'),
      startedAt: r.started_at ?? undefined,
      finishedAt: r.finished_at ?? undefined,
      failure: r.failure ?? undefined,
    }))
  }

  recordSourceRefs(runId: string, refs: SourceRef[]): void {
    this.db.prepare('UPDATE workflow_runs SET source_refs = ? WHERE id = ?').run(JSON.stringify(refs), runId)
  }

  recordModelDecision(runId: string, decision: ModelDecision): void {
    const run = this.getRun(runId)
    const decisions = [...run.modelDecisions, decision]
    this.db.prepare('UPDATE workflow_runs SET model_decisions = ? WHERE id = ?').run(JSON.stringify(decisions), runId)
  }

  attachArtifact(runId: string, artifactId: string): void {
    const run = this.getRun(runId)
    const refs = [...new Set([...run.outputRefs, artifactId])]
    this.db.prepare('UPDATE workflow_runs SET output_refs = ? WHERE id = ?').run(JSON.stringify(refs), runId)
  }

  attachApproval(runId: string, approvalId: string): void {
    const run = this.getRun(runId)
    const refs = [...new Set([...run.approvalRefs, approvalId])]
    this.db.prepare('UPDATE workflow_runs SET approval_refs = ? WHERE id = ?').run(JSON.stringify(refs), runId)
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private definitionForRun(runId: string): WorkflowDefinition {
    const run = this.getRun(runId)
    return this.getDefinition(run.workflowId)
  }

  private stepRows(runId: string): StepRow[] {
    return this.db.prepare('SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY rowid').all(runId) as unknown as StepRow[]
  }

  private setStatus(runId: string, status: WorkflowRunStatus, error?: string): void {
    if (status === 'completed' || status === 'failed') {
      this.db
        .prepare('UPDATE workflow_runs SET status = ?, finished_at = ?, error = COALESCE(?, error) WHERE id = ?')
        .run(status, new Date().toISOString(), error ?? null, runId)
    } else {
      this.db.prepare('UPDATE workflow_runs SET status = ? WHERE id = ?').run(status, runId)
    }
  }

  private skipRemaining(runId: string): void {
    this.db
      .prepare("UPDATE workflow_steps SET status = 'skipped' WHERE run_id = ? AND status IN ('pending','running')")
      .run(runId)
  }

  private skipRemainingAfter(runId: string, stepId: string): void {
    this.db
      .prepare(
        "UPDATE workflow_steps SET status = 'skipped' WHERE run_id = ? AND status IN ('pending','running') AND rowid > (SELECT rowid FROM workflow_steps WHERE id = ?)",
      )
      .run(runId, stepId)
  }

  private begin() {
    this.db.exec('BEGIN IMMEDIATE')
    return {
      commit: () => this.db.exec('COMMIT'),
      rollback: () => this.db.exec('ROLLBACK'),
    }
  }
}

function safeParse(text: string | null): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
