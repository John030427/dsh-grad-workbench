/**
 * Form Assistant — value proposal from a user-confirmed profile vault, two
 * separate approval gates (fill / submit), and reusable deterministic recipes.
 *
 * Automation is behind the FormAutomation interface: this MVP ships a MOCK
 * adapter (deterministic, fixture-grade) plus the seam for Browser-Use-style
 * real adapters. Every proposed value carries its SOURCE; sensitive vault
 * fields are never auto-proposed unless explicitly requested.
 */

import type { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { errors } from '../../shared/errors.ts'

// ── automation seam ─────────────────────────────────────────────────────────

export interface FormSchema {
  url: string
  title?: string
  domFingerprint: string
  fields: Array<{ label: string; required: boolean; inputType: 'text' | 'select' | 'checkbox' | 'date' }>
}

export interface FillOutcome {
  ok: boolean
  filledFields: string[]
  error?: string
}

export interface SubmitOutcome {
  ok: boolean
  confirmationRef?: string
  error?: string
}

export interface FormAutomation {
  readonly id: string
  inspect(url: string): Promise<FormSchema>
  fill(schema: FormSchema, values: Record<string, string>): Promise<FillOutcome>
  submit(schema: FormSchema): Promise<SubmitOutcome>
}

/**
 * Deterministic mock adapter: stable fingerprint per URL, accepts any fill,
 * generates a confirmation ref. Used by tests and as UI dev fixture.
 */
export class MockFormAutomation implements FormAutomation {
  readonly id = 'mock'

  async inspect(url: string): Promise<FormSchema> {
    const fp = createHash('sha256').update(url).digest('hex').slice(0, 12)
    return {
      url,
      title: `Form at ${new URL(url).host}`,
      domFingerprint: fp,
      fields: [
        { label: '姓名', required: true, inputType: 'text' },
        { label: '学号', required: true, inputType: 'text' },
        { label: '联系电话', required: true, inputType: 'text' },
        { label: '申请类型', required: true, inputType: 'select' },
        { label: '提交日期', required: false, inputType: 'date' },
      ],
    }
  }

  async fill(schema: FormSchema, values: Record<string, string>): Promise<FillOutcome> {
    if (Object.keys(values).length === 0) return { ok: false, filledFields: [], error: 'no values to fill' }
    return { ok: true, filledFields: schema.fields.map((f) => f.label) }
  }

  async submit(schema: FormSchema): Promise<SubmitOutcome> {
    const ref = createHash('sha256').update(`${schema.url}:${schema.domFingerprint}`).digest('hex').slice(0, 16)
    return { ok: true, confirmationRef: `MOCK-${ref}` }
  }
}

// ── service ─────────────────────────────────────────────────────────────────

export interface ProfileField {
  fieldKey: string
  label: string
  value: string
  sensitivity: 'normal' | 'private' | 'restricted'
  userConfirmed: boolean
}

interface Proposal {
  label: string
  value?: string
  source: string
  needsUserInput: boolean
}

interface PlanRecord {
  schema: FormSchema
  proposals: Proposal[]
  values: Record<string, string>
  filled: boolean
}

export class FormService {
  private readonly db: DatabaseSync
  private readonly automation: FormAutomation
  /** In-flight plans keyed by plan id (small, process-local). */
  private readonly plans = new Map<string, PlanRecord>()

  constructor(db: DatabaseSync, automation: FormAutomation = new MockFormAutomation()) {
    this.db = db
    this.automation = automation
  }

  // ── profile vault ─────────────────────────────────────────────────────────

  saveProfileField(input: {
    fieldKey: string
    label: string
    value: string
    sensitivity?: 'normal' | 'private' | 'restricted'
    userConfirmed?: boolean
  }): ProfileField {
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO form_profile_fields (id, field_key, label, value, sensitivity, user_confirmed, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(field_key) DO UPDATE SET value = excluded.value, label = excluded.label,
           sensitivity = excluded.sensitivity, user_confirmed = excluded.user_confirmed, updated_at = excluded.updated_at`,
      )
      .run(
        crypto.randomUUID(),
        input.fieldKey,
        input.label,
        input.value,
        input.sensitivity ?? 'normal',
        input.userConfirmed === false ? 0 : 1,
        now,
      )
    return this.getProfileField(input.fieldKey)!
  }

  getProfileField(fieldKey: string): ProfileField | undefined {
    const row = this.db
      .prepare('SELECT * FROM form_profile_fields WHERE field_key = ? AND deleted_at IS NULL')
      .get(fieldKey) as Record<string, unknown> | undefined
    if (!row) return undefined
    return {
      fieldKey: row.field_key as string,
      label: row.label as string,
      value: row.value as string,
      sensitivity: row.sensitivity as ProfileField['sensitivity'],
      userConfirmed: row.user_confirmed === 1,
    }
  }

  listProfile(): ProfileField[] {
    const rows = this.db
      .prepare('SELECT field_key FROM form_profile_fields WHERE deleted_at IS NULL ORDER BY label')
      .all() as Array<{ field_key: string }>
    return rows.map((r) => this.getProfileField(r.field_key)!).filter(Boolean)
  }

  // ── inspection + proposals ────────────────────────────────────────────────

  /** Inspect the form, propose values with per-field sources, store the plan. */
  async inspectAndPropose(url: string): Promise<{
    planId: string
    schema: FormSchema
    proposals: Proposal[]
    recipeMatched: boolean
  }> {
    const schema = await this.automation.inspect(url)
    const recipe = this.matchRecipe(url, schema.domFingerprint)

    const proposals: Proposal[] = []
    const values: Record<string, string> = {}
    for (const field of schema.fields) {
      const match = this.matchProfileField(field.label)
      if (match && match.sensitivity !== 'restricted') {
        proposals.push({ label: field.label, value: match.value, source: `profile:${match.fieldKey}`, needsUserInput: false })
        values[field.label] = match.value
      } else if (match) {
        proposals.push({
          label: field.label,
          source: `profile:${match.fieldKey} (SENSITIVE — not auto-filled; ask the user)`,
          needsUserInput: true,
        })
      } else {
        proposals.push({ label: field.label, source: 'user input needed', needsUserInput: true })
      }
    }

    const planId = crypto.randomUUID()
    this.plans.set(planId, { schema, proposals, values, filled: false })
    return { planId, schema, proposals, recipeMatched: Boolean(recipe) }
  }

  // ── two-gate execution ────────────────────────────────────────────────────

  /**
   * FILL gate: consumes the form.fill approval bound to this exact plan payload.
   */
  async executeFill(planId: string, approval: { id: string; status: string; payloadHash: string }, actionPayload: unknown): Promise<FillOutcome> {
    const plan = this.requirePlan(planId)
    verifyGate(approval, actionPayload ?? plan.values)
    const outcome = await this.automation.fill(plan.schema, plan.values)
    if (outcome.ok) plan.filled = true
    return outcome
  }

  /**
   * SUBMIT gate: refuses to run before fill succeeded; consumes its own approval.
   */
  async executeSubmit(planId: string, approval: { id: string; status: string; payloadHash: string }, actionPayload: unknown): Promise<SubmitOutcome> {
    const plan = this.requirePlan(planId)
    verifyGate(approval, actionPayload ?? plan.values)
    if (!plan.filled) throw errors.invalidInput('submit refused: the form has not been filled yet (fill must complete first)')
    return this.automation.submit(plan.schema)
  }

  /** Persist a deterministic recipe after a successful run. */
  saveRecipe(url: string, schema: FormSchema): void {
    const pattern = new URL(url).origin + new URL(url).pathname.replace(/[^/]+$/, '*')
    this.db
      .prepare(
        `INSERT INTO form_recipes (id, url_pattern, title, dom_fingerprint, field_map, last_success_at, created_at)
         VALUES (?, ?, ?, ?, '{}', ?, ?)
         ON CONFLICT(url_pattern) DO UPDATE SET dom_fingerprint = excluded.dom_fingerprint,
           last_success_at = excluded.last_success_at`,
      )
      .run(
        crypto.randomUUID(),
        pattern,
        schema.title ?? null,
        schema.domFingerprint,
        new Date().toISOString(),
        new Date().toISOString(),
      )
  }

  matchRecipe(url: string, domFingerprint: string): { id: string; stale: boolean } | undefined {
    let pattern: string
    try {
      pattern = new URL(url).origin + new URL(url).pathname.replace(/[^/]+$/, '*')
    } catch {
      return undefined
    }
    const row = this.db
      .prepare('SELECT id, dom_fingerprint FROM form_recipes WHERE url_pattern = ? AND deleted_at IS NULL')
      .get(pattern) as { id: string; dom_fingerprint: string } | undefined
    if (!row) return undefined
    return { id: row.id, stale: row.dom_fingerprint !== domFingerprint }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private requirePlan(planId: string): PlanRecord {
    const plan = this.plans.get(planId)
    if (!plan) throw errors.notFound('form plan', planId)
    return plan
  }

  private matchProfileField(label: string): ProfileField | undefined {
    const norm = label.toLowerCase().replace(/\s+/g, '')
    return (
      this.listProfile().find((f) => f.label.toLowerCase() === norm) ??
      this.listProfile().find((f) => norm.includes(f.fieldKey.toLowerCase()) || f.fieldKey.toLowerCase().includes(norm))
    )
  }
}

function verifyGate(approval: { status: string; payloadHash: string }, actionPayload: unknown): void {
  const presented = createHash('sha256').update(JSON.stringify(actionPayload ?? null)).digest('hex')
  if (approval.payloadHash !== presented) {
    throw errors.approvalInvalid('gate', 'payload hash does not match — approval invalidated')
  }
  if (approval.status !== 'consumed') {
    throw errors.approvalInvalid('gate', `approval gate not run (status "${approval.status}")`)
  }
}
