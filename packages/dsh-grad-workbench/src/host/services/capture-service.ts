/**
 * Universal Inbox capture + deterministic task router.
 * Routing ladder (PRD §6.1): 1) deterministic rules → 2) cheap classifier →
 * 3) small LLM router only when ambiguous. Only layer 1 exists in MVP;
 * ambiguous captures keep status 'new' with a low-confidence guess.
 */

import type { DatabaseSync } from 'node:sqlite'
import type { CaptureItem, CaptureSource, CaptureStatus } from '../../shared/contracts.ts'

export interface RouteGuess {
  intent: string
  confidence: number
}

/** Deterministic rules — ordered; first match wins. */
const RULES: Array<{ pattern: RegExp; intent: string; confidence: number }> = [
  { pattern: /(最近|latest|newest|最新).{0,24}(论文|papers?|文献)|literature review|文献综述/i, intent: 'research.literature-radar', confidence: 0.9 },
  { pattern: /论文|paper|文献|research/i, intent: 'research', confidence: 0.55 },
  { pattern: /(老师|导师|advisor|professor).{0,20}(回复|reply|意思|mean)|帮我回复/i, intent: 'communication.advisor-reply', confidence: 0.85 },
  { pattern: /老师|导师|advisor/i, intent: 'communication', confidence: 0.5 },
  { pattern: /志愿|volunteer|义工/i, intent: 'life.ledger-volunteer', confidence: 0.85 },
  { pattern: /(健身|workout|训练).{0,10}(记录|log)|打卡/i, intent: 'life.ledger-fitness', confidence: 0.8 },
  { pattern: /(饭店|餐厅|restaurant|店).{0,10}(记|save|收藏)|想吃/i, intent: 'life.food-map', confidence: 0.8 },
  { pattern: /(填|fill).{0,8}(表|form)|申请表/i, intent: 'automation.form-assistant', confidence: 0.85 },
]

export function routeCapture(text: string): RouteGuess {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { intent: rule.intent, confidence: rule.confidence }
    }
  }
  return { intent: 'inbox.unrouted', confidence: 0.2 }
}

export class CaptureService {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  create(input: { text?: string; source?: CaptureSource; sourceRef?: string; mimeType?: string }): CaptureItem {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const source = input.source ?? 'dsh'
    const guess = input.text ? routeCapture(input.text) : { intent: 'inbox.unrouted', confidence: 0.1 }
    const status: CaptureStatus = guess.confidence >= 0.5 ? 'routed' : 'new'
    this.db
      .prepare(
        `INSERT INTO capture_items (id, created_at, source, source_ref, mime_type, text, inferred_intent, route_confidence, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, createdAt, source, input.sourceRef ?? null, input.mimeType ?? null, input.text ?? null, guess.intent, guess.confidence, status)
    return this.get(id)
  }

  get(id: string): CaptureItem {
    const row = this.db.prepare('SELECT * FROM capture_items WHERE id = ? AND deleted_at IS NULL').get(id) as
      | Record<string, unknown>
      | undefined
    if (!row) throw new Error(`capture item not found: ${id}`)
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      source: row.source as CaptureSource,
      sourceRef: (row.source_ref as string) ?? undefined,
      mimeType: (row.mime_type as string) ?? undefined,
      text: (row.text as string) ?? undefined,
      inferredIntent: (row.inferred_intent as string) ?? undefined,
      routeConfidence: (row.route_confidence as number) ?? undefined,
      status: row.status as CaptureStatus,
    }
  }

  list(filter: { status?: CaptureStatus; limit?: number } = {}): CaptureItem[] {
    const clauses = ['deleted_at IS NULL']
    const params: Array<string | number> = []
    if (filter.status) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    params.push(filter.limit ?? 50)
    const rows = this.db
      .prepare(`SELECT id FROM capture_items WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`)
      .all(...params) as Array<{ id: string }>
    return rows.map((r) => this.get(r.id))
  }

  archive(id: string): CaptureItem {
    this.get(id)
    this.db.prepare("UPDATE capture_items SET status = 'archived' WHERE id = ?").run(id)
    return this.get(id)
  }
}
