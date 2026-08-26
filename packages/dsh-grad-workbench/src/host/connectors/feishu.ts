/**
 * FeishuCliConnector — P0 Feishu adapter over the official `larksuite/cli`.
 *
 * Credential policy: authentication lives in the CLI's own auth store; tokens
 * are never copied into Graduate OS storage or logs.
 *
 * Execution contract: every execute() consumes an APPROVED approval whose
 * payload hash matches the action — mutated payloads and reused approvals are
 * rejected before any external call (tested).
 *
 * The real `lark` binary is not installed on the development machine, so argv
 * templates below follow the documented larksuite/cli shape and MUST be
 * verified against the installed version during credential-enabled smoke
 * testing. Tests exercise this file through an injected mock executor.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { errors } from '../../shared/errors.ts'
import { payloadHash } from '../services/approval-service.ts'
import type { ConnectorAction, Connector, ConnectorCapabilities, ConnectorHealth, ConnectorPreview, ConnectorResult, ExecutionContext } from './types.ts'

export interface CliExecutor {
  (argv: readonly string[], opts: { timeoutMs: number }): Promise<{ code: number; stdout: string; stderr: string }>
}

const DEFAULT_TIMEOUT_MS = 30_000

export interface FeishuCliConnectorOptions {
  cliPath?: string
  executor?: CliExecutor
  timeoutMs?: number
}

/** Real process runner — args array only, never a shell string. */
export const processExecutor: CliExecutor = (argv, { timeoutMs }) =>
  new Promise((resolve) => {
    const child = spawn(argv[0]!, argv.slice(1), { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.stdout?.on('data', (d) => {
      stdout += String(d)
    })
    child.stderr?.on('data', (d) => {
      stderr += String(d)
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: `${stderr}${err.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })

/**
 * Canonical argv for each action. Content larger than ~2k chars goes through a
 * temp file to dodge command-line length limits on Windows.
 */
export function buildArgv(action: ConnectorAction, cliPath: string): { argv: string[]; cleanup?: () => void } {
  switch (action.type) {
    case 'doc.create': {
      if (action.markdown.length > 2000) {
        const dir = mkdtempSync(join(tmpdir(), 'grad-feishu-'))
        const file = join(dir, 'content.md')
        writeFileSync(file, action.markdown)
        return {
          argv: [cliPath, 'doc', 'create', '--title', action.title, '--content-file', file],
          cleanup: () => rmSync(dir, { recursive: true, force: true }),
        }
      }
      return { argv: [cliPath, 'doc', 'create', '--title', action.title, '--content', action.markdown] }
    }
    case 'doc.append':
      return { argv: [cliPath, 'doc', 'append', '--document', action.documentId, '--content', action.markdown] }
    case 'im.send':
      return {
        argv: [cliPath, 'im', 'send', '--receive-id-type', action.receiveIdType, '--receive-id', action.receiveId, '--text', action.text],
      }
    case 'base.row-insert': {
      const fields = JSON.stringify(action.fields)
      return { argv: [cliPath, 'base', 'record', 'create', '--app', action.appToken, '--table', action.tableId, '--fields', fields] }
    }
  }
}

function describe(action: ConnectorAction): { summary: string; destination: string } {
  switch (action.type) {
    case 'doc.create':
      return { summary: `Create Feishu document "${action.title}" (${action.markdown.split('\n').length} lines of Markdown)`, destination: 'Feishu Docs' }
    case 'doc.append':
      return { summary: `Append ${action.markdown.length} characters to Feishu document ${action.documentId}`, destination: `Feishu doc ${action.documentId}` }
    case 'im.send':
      return { summary: `Send message to ${action.receiveIdType} ${action.receiveId}: "${action.text.slice(0, 80)}${action.text.length > 80 ? '…' : ''}"`, destination: `Feishu IM ${action.receiveId}` }
    case 'base.row-insert':
      return { summary: `Insert 1 row with ${Object.keys(action.fields).length} fields into table ${action.tableId}`, destination: `Feishu Base ${action.appToken}/${action.tableId}` }
  }
}

export class FeishuCliConnector implements Connector {
  readonly id = 'feishu'
  readonly label = 'Feishu / Lark (official CLI)'
  private readonly db: DatabaseSync
  private readonly opts: {
    cliPath?: string
    executor?: CliExecutor
    timeoutMs?: number
  }

  constructor(db: DatabaseSync, opts: FeishuCliConnectorOptions = {}) {
    this.db = db
    this.opts = opts
  }

  private get cliPath(): string {
    return this.opts.cliPath ?? process.env.LARK_CLI_PATH ?? 'lark'
  }

  capabilities(): ConnectorCapabilities {
    return {
      actions: ['doc.create', 'doc.append', 'im.send', 'base.row-insert'],
      notes:
        'Uses the official Lark/Feishu CLI auth store. Publish actions always require explicit approval; the CLI binary must be installed and authenticated.',
    }
  }

  async health(): Promise<ConnectorHealth> {
    const exec = this.opts.executor ?? processExecutor
    const res = await exec([this.cliPath, '--version'], { timeoutMs: 5000 })
    if (res.code !== 0) {
      return {
        ok: false,
        reason:
          'larksuite/cli not found or not runnable. Install it and authenticate with your Feishu account, or set LARK_CLI_PATH.',
      }
    }
    return { ok: true }
  }

  async preview(action: ConnectorAction): Promise<ConnectorPreview> {
    const d = describe(action)
    const card = [
      `**Action:** ${d.summary}`,
      '',
      '**Destination:** ' + d.destination,
      '',
      action.type === 'doc.create' || action.type === 'doc.append' ? '```markdown\n' + action.markdown.slice(0, 1200) + '\n```' : `\`\`\`\n${JSON.stringify(action, null, 2).slice(0, 800)}\n\`\`\``,
      '',
      '_External write: YES — requires approval._',
    ].join('\n')
    return { summary: d.summary, destination: d.destination, card }
  }

  async execute(action: ConnectorAction, ctx: ExecutionContext): Promise<ConnectorResult> {
    // Gate verification: the approval gate (workflow engine or execute tool)
    // must ALREADY have consumed an approval bound to this exact payload.
    if (ctx.approval.payloadHash !== payloadHash(action)) {
      throw errors.approvalInvalid(ctx.approval.id, 'payload hash does not match this action')
    }
    if (ctx.approval.status !== 'consumed') {
      throw errors.approvalInvalid(
        ctx.approval.id,
        `approval gate not run (status "${ctx.approval.status}") — consume the approval before executing`,
      )
    }

    // Durable exactly-once: one connector event per approval id, ever.
    const d = describe(action)
    const eventId = crypto.randomUUID()
    try {
      this.db
        .prepare(
          `INSERT INTO connector_events (id, connector_id, action_type, approval_id, summary, created_at)
           VALUES (?, 'feishu', ?, ?, ?, ?)`,
        )
        .run(eventId, action.type, ctx.approval.id, d.summary, new Date().toISOString())
    } catch {
      throw errors.approvalInvalid(ctx.approval.id, 'this approval has already been executed (duplicate publish blocked)')
    }

    try {
      const health = await this.health()
      if (!health.ok) {
        this.finishEvent(eventId, false, undefined, health.reason)
        return { ok: false, error: health.reason }
      }

      const exec = this.opts.executor ?? processExecutor
      const { argv, cleanup } = buildArgv(action, this.cliPath)
      try {
        const res = await exec(argv, { timeoutMs: this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS })
        if (res.code !== 0) {
          const error = `lark cli exit ${res.code}: ${res.stderr.slice(0, 400) || res.stdout.slice(0, 400)}`
          this.finishEvent(eventId, false, undefined, error)
          return { ok: false, error }
        }
        const raw = safeParse(res.stdout)
        const externalRef = extractRef(res.stdout)
        this.finishEvent(eventId, true, externalRef, undefined)
        return { ok: true, ...(raw ? { raw } : {}), ...(externalRef ? { externalRef } : {}) }
      } finally {
        cleanup?.()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.finishEvent(eventId, false, undefined, message)
      throw err
    }
  }

  private finishEvent(eventId: string, ok: boolean, externalRef?: string, error?: string): void {
    this.db
      .prepare('UPDATE connector_events SET ok = ?, external_ref = ?, error = ? WHERE id = ?')
      .run(ok ? 1 : 0, externalRef ?? null, error ?? null, eventId)
  }
}

function safeParse(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function extractRef(stdout: string): string | undefined {
  const urlMatch = stdout.match(/https?:\/\/[^\s"']+/)
  return urlMatch?.[0]
}
