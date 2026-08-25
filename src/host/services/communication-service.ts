/**
 * Communication assistant — advisor/teacher message understanding and reply
 * drafting. Deterministic keyword-level analysis (no model claims), drafts are
 * artifacts, and the no-invented-progress rule is structural: reply skeletons
 * can only reference facts the USER supplied, otherwise they render explicit
 * fill-in placeholders.
 *
 * MVP deliberately does NOT send anything. Sending is a separate approved
 * connector action (feishu im.send).
 */

import type { ArtifactStore } from './artifact-store.ts'
import type { MemoryService } from './memory-service.ts'

export interface Understanding {
  relationship: 'advisor' | 'teacher' | 'reviewer' | 'admin' | 'senior' | 'collaborator' | 'unknown'
  scenario:
    | 'progress'
    | 'correction'
    | 'meeting'
    | 'leave'
    | 'defense'
    | 'deadline'
    | 'request'
    | 'reminder'
    | 'general'
  intent: 'question' | 'request' | 'inform' | 'reminder' | 'urgency' | 'feedback'
  risk: 'low' | 'medium' | 'high'
  keyPoints: string[]
  commitments: Array<{ what: string; due?: string }>
  coreDemand: string
  note: string
}

export interface ReplyDraft {
  tone: string
  markdown: string
}

const RULES = {
  relationship: [
    [/(导师|advisor)/i, 'advisor'],
    [/(组会|课题组)/i, 'advisor'],
    [/(老师|teacher|professor|教授)/i, 'teacher'],
    [/(评审|reviewer|审稿)/i, 'reviewer'],
    [/(教务|秘书|admin|行政)/i, 'admin'],
    [/(学长|学姐|senior|博士兄)/i, 'senior'],
    [/(合作者|collaborator|同组)/i, 'collaborator'],
  ],
  scenario: [
    [/(催|进度|进展|update|progress|汇报)/i, 'progress'],
    [/(批改|修改意见|revision|correction|重写|返修)/i, 'correction'],
    [/(组会|会议|meeting|zoom|腾讯会议)/i, 'meeting'],
    [/(请假|病假|事假|leave)/i, 'leave'],
    [/(答辩|defense|预答辩)/i, 'defense'],
    [/(截稿|deadline|截止|投稿|submit)/i, 'deadline'],
    [/(记得|别忘了|remind)/i, 'reminder'],
  ],
  intent: [
    [/(尽快|马上|今天|今晚|asap|urgent)/i, 'urgency'],
    [/(吗|？|\?|是否|能不能|可否)/i, 'question'],
    [/(请|麻烦|需要你|希望你|please)/i, 'request'],
    [/(记得|别忘了|don't forget)/i, 'reminder'],
    [/(通知|告知|announce|inform)/i, 'inform'],
    [/(建议|反馈|意见|feedback|comment)/i, 'feedback'],
  ],
} as const

function firstMatch(text: string, rules: ReadonlyArray<readonly [RegExp, string]>, fallback: string): string {
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) return label
  }
  return fallback
}

/** Extract obligations and dates the advisor explicitly stated. */
export function extractCommitments(text: string): Array<{ what: string; due?: string }> {
  const commitments: Array<{ what: string; due?: string }> = []
  const sentences = text.split(/(?<=[。！？!?;\n])\s*/)
  const obligationRe = /(需要你|请你|麻烦你|希望你|记得|别忘了|请把|请将|请提交|请发|please|need you to|submit)/i
  const actionRe = /(发我|提交|完成|回复|交|回我)/
  const dateRe =
    /(周[一二三四五六日天]|下[周星期]?[一二三四五六日天]|本[周月末]|今天|明天|后天|\d{1,2}月\d{1,2}[日号]|\d{4}-\d{1,2}-\d{1,2}|before [a-z]+day|by [a-z]+day|friday|monday|sunday|saturday)/i

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const hasObligation = obligationRe.test(trimmed)
    const dueMatch = trimmed.match(dateRe)
    if (hasObligation || (dueMatch && actionRe.test(trimmed))) {
      // Only sentences that look actionable become commitments.
      if (trimmed.length <= 120 && (hasObligation ? true : /\d/.test(trimmed) || Boolean(dueMatch))) {
        commitments.push({ what: trimmed, ...(dueMatch ? { due: dueMatch[0] } : {}) })
      }
    }
  }
  return commitments.slice(0, 5)
}

export class CommunicationService {
  private readonly artifacts: ArtifactStore
  private readonly memory: MemoryService

  constructor(artifacts: ArtifactStore, memory: MemoryService) {
    this.artifacts = artifacts
    this.memory = memory
  }

  understand(text: string): Understanding {
    const relationship = firstMatch(text, RULES.relationship, 'unknown') as Understanding['relationship']
    const scenario = firstMatch(text, RULES.scenario, 'general') as Understanding['scenario']
    const intent = firstMatch(text, RULES.intent, 'inform') as Understanding['intent']
    const risk: Understanding['risk'] =
      intent === 'urgency' || scenario === 'defense' || scenario === 'correction'
        ? 'high'
        : scenario === 'progress' || scenario === 'deadline'
          ? 'medium'
          : 'low'

    const keyPoints = text
      .split(/(?<=[。！？!?;\n])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 6 && s.length <= 120)
      .slice(0, 5)

    return {
      relationship,
      scenario,
      intent,
      risk,
      keyPoints,
      commitments: extractCommitments(text),
      coreDemand:
        scenario === 'progress'
          ? '对方想了解你的研究进展（不要虚构进度，只引用你确认过的事实）'
          : scenario === 'correction'
            ? '对方指出了需要修改的问题，回复应先确认收到并说明修改计划'
            : scenario === 'meeting'
              ? '对方在协调会议时间，回复应明确你的可用时间或确认时间'
              : scenario === 'deadline'
                ? '消息涉及截止日期，回复应确认你知悉并说明计划'
                : '先复述你的理解，再给出回应',
      note: 'Deterministic keyword-level analysis (MVP). Treat as hints, not ground truth.',
    }
  }

  /**
   * Generate tone-varied reply drafts. `userFacts` is the ONLY source of
   * substantive claims; everything else becomes an explicit placeholder.
   */
  draft(input: {
    originalText: string
    userFacts?: string
    tone?: 'formal' | 'warm'
  }): { drafts: ReplyDraft[]; contextUsed: Array<{ id: string; content: string; why: string }> } {
    const u = this.understand(input.originalText)

    // Memory context: advisor preferences etc., with provenance.
    const contextUsed: Array<{ id: string; content: string; why: string }> = this.memory
      .search({ query: '导师 advisor 回复 语气 preference', limit: 3 })
      .map((r) => ({ id: r.item.id, content: r.item.content, why: r.why }))

    const facts = input.userFacts?.trim()
    const factsBlock = facts ?? '【待填写：你实际完成的事项——系统不会替你编造】'
    const nextBlock = '【待填写：下一步计划】'

    const formal = [
      `${salutation(u.relationship)}，您好：`,
      '',
      `收到您的消息。关于${scenarioLabel(u.scenario)}，情况如下：`,
      '',
      factsBlock,
      '',
      `接下来我计划：${nextBlock}`,
      '',
      u.commitments.some((c) => c.due)
        ? `我会确保在 ${u.commitments.find((c) => c.due)!.due} 之前完成。`
        : '如有具体时间要求，请您告知，我会按时完成。',
      '',
      '祝好！',
    ].join('\n')

    const warm = [
      `${salutation(u.relationship)}好！`,
      '',
      '看到您的消息啦～',
      '',
      factsBlock,
      '',
      `下一步我打算：${nextBlock}`,
      '',
      '有任何其他安排需要配合的，随时告诉我！',
    ].join('\n')

    const drafts: ReplyDraft[] = [
      { tone: 'formal', markdown: formal },
      { tone: 'warm', markdown: warm },
      ...(input.tone === 'formal' || input.tone === 'warm'
        ? []
        : [{ tone: 'brief', markdown: `${salutation(u.relationship)}您好，已收到。简要汇报：${factsBlock}` }]),
    ]

    return { drafts, contextUsed }
  }

  /** Persist a chosen draft as a communication-draft artifact. */
  saveDraft(params: { originalText: string; markdown: string }): { artifactId: string } {
    const ref = this.artifacts.put({
      kind: 'communication-draft',
      mediaType: 'text/markdown',
      bytes: params.markdown,
      sourceRefs: [
        {
          id: `comm-src-${crypto.randomUUID()}`,
          kind: 'message',
          ref: params.originalText.slice(0, 200),
          title: 'Advisor/teacher original message',
          createdAt: new Date().toISOString(),
        },
      ],
    })
    return { artifactId: ref.id }
  }
}

function salutation(relationship: Understanding['relationship']): string {
  switch (relationship) {
    case 'advisor':
      return '老师'
    case 'teacher':
      return '老师'
    case 'reviewer':
      return '尊敬的评审专家'
    case 'admin':
      return '老师'
    case 'senior':
      return '学长/学姐'
    case 'collaborator':
      return '你好'
    default:
      return '您好'
  }
}

function scenarioLabel(scenario: Understanding['scenario']): string {
  switch (scenario) {
    case 'progress':
      return '研究进展'
    case 'correction':
      return '修改事宜'
    case 'meeting':
      return '会议安排'
    case 'leave':
      return '请假事宜'
    case 'defense':
      return '答辩准备'
    case 'deadline':
      return '截止时间'
    case 'reminder':
      return '您提醒的事项'
    case 'request':
      return '您的请求'
    default:
      return '相关事宜'
  }
}
