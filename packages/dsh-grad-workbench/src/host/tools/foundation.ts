/**
 * Foundation native-agent tools: ping, universal inbox, workflow runs, approvals.
 * All outputs are serializable JSON rendered as one text block.
 */

import { resolveDataDir } from '../env.ts'
import type { HostServices } from '../services/index.ts'
import type { ToolsService, ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

export function registerFoundationTools(tools: ToolsService, services: HostServices): Array<() => void> {
  const definitions: ToolDefinition[] = [makePingTool(services), ...makeFoundationTools(services)]
  return definitions.map((def) => tools.register(def))
}

let PLUGIN_VERSION = '0.0.0'
export function setToolVersion(version: string): void {
  PLUGIN_VERSION = version
}

function makePingTool(services: HostServices): ToolDefinition {
  return defineGradTool({
    name: 'grad_ping',
    description:
      'Health check for the Graduate OS (dsh-grad-workbench) plugin. Returns plugin version, data directory and registered workflows.',
    parameters: {},
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        plugin: { type: 'string' },
        version: { type: 'string' },
        dataDir: { type: 'string' },
        workflows: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, title: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
        },
      },
      ['ok', 'plugin', 'version', 'dataDir'],
    ),
    execute() {
      return Promise.resolve({
        ok: true,
        plugin: 'dsh-grad-workbench',
        version: PLUGIN_VERSION,
        dataDir: resolveDataDir(),
        workflows: services.workflows.listWorkflows().map((w) => ({ id: w.id, title: w.title })),
      })
    },
  })
}

function makeFoundationTools(services: HostServices): ToolDefinition[] {
  const capture = defineGradTool({
    name: 'grad_capture',
    description:
      'Capture an item into the Graduate OS universal inbox (text). Deterministic routing assigns an intent like research.literature-radar or communication.advisor-reply when confident.',
    parameters: {
      text: { type: 'string', description: 'Captured text content', required: true },
      source: {
        type: 'string',
        enum: ['dsh', 'feishu', 'wechat', 'file', 'browser', 'share'],
        description: 'Where the capture came from',
      },
    },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        captureId: { type: 'string' },
        intent: { type: 'string' },
        confidence: { type: 'number' },
        status: { type: 'string' },
      },
      ['ok', 'captureId', 'intent', 'confidence', 'status'],
    ),
    execute(args) {
      const a = args as { text: string; source?: string }
      const item = services.captures.create({ text: a.text, source: a.source as never })
      return Promise.resolve({
        ok: true,
        captureId: item.id,
        intent: item.inferredIntent ?? 'inbox.unrouted',
        confidence: item.routeConfidence ?? 0,
        status: item.status,
      })
    },
  })

  const runWorkflow = defineGradTool({
    name: 'grad_run_workflow',
    description:
      'Start a registered Graduate OS workflow and wait until it completes or parks waiting for user approval. Registered IDs include echo-demo.',
    parameters: {
      workflowId: { type: 'string', description: 'Workflow ID, e.g. echo-demo', required: true },
      input: { type: 'object', additionalProperties: true, description: 'Workflow input payload' },
    },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        runId: { type: 'string' },
        status: { type: 'string' },
        error: { type: 'string' },
        hint: { type: 'string' },
      },
      ['ok', 'runId', 'status'],
    ),
    async execute(args) {
      const a = args as { workflowId: string; input?: unknown }
      const run = await services.workflows.start(a.workflowId, a.input ?? {})
      return {
        ok: true,
        runId: run.id,
        status: run.status,
        ...(run.error ? { error: run.error } : {}),
        ...(run.status === 'waiting_approval'
          ? {
              hint:
                'Run parked: show the user each pending approval (grad_approval_get), then resolve via grad_approval_resolve on their explicit decision.',
            }
          : {}),
      }
    },
  })

  const getRun = defineGradTool({
    name: 'grad_get_run',
    description: 'Inspect one workflow run: status, steps, approvals and artifacts (full provenance view).',
    parameters: { runId: { type: 'string', required: true } },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        run: { type: 'object', properties: {}, required: [], additionalProperties: true },
        steps: { type: 'array', items: { type: 'object', properties: {}, required: [], additionalProperties: true } },
        approvals: { type: 'array', items: { type: 'object', properties: {}, required: [], additionalProperties: true } },
      },
      ['ok', 'run'],
    ),
    async execute(args) {
      const runId = (args as { runId: string }).runId
      const run = services.workflows.getRun(runId)
      return Promise.resolve({
        ok: true,
        run,
        steps: services.workflows.getSteps(runId),
        approvals: services.approvals.list({ workflowRunId: runId }),
      })
    },
  })

  const listRuns = defineGradTool({
    name: 'grad_list_runs',
    description: 'List recent Graduate OS workflow runs, newest first.',
    parameters: {
      status: {
        type: 'string',
        enum: ['queued', 'running', 'waiting_approval', 'failed', 'completed'],
        description: 'Filter by status',
      },
      limit: { type: 'integer', description: 'Max rows (default 25)' },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, count: { type: 'integer' }, runs: { type: 'array', items: { type: 'string' } } },
      ['ok', 'count', 'runs'],
    ),
    execute(args) {
      const a = args as { status?: string; limit?: number }
      const runs = services.workflows.listRuns({ status: a.status as never, limit: a.limit ?? 25 })
      return Promise.resolve({
        ok: true,
        count: runs.length,
        runs: runs.map((r) => `${r.id} (${r.workflowId}, ${r.status})`),
      })
    },
  })

  const approvalGet = defineGradTool({
    name: 'grad_approval_get',
    description:
      'Fetch one approval request (action, summary, payload, destination) so it can be shown to the user before resolving.',
    parameters: { approvalId: { type: 'string', required: true } },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, approval: { type: 'object', properties: {}, required: [], additionalProperties: true } },
      ['ok', 'approval'],
    ),
    execute(args) {
      const approvalId = (args as { approvalId: string }).approvalId
      return Promise.resolve({ ok: true, approval: services.approvals.get(approvalId) })
    },
  })

  const approvalResolve = defineGradTool({
    name: 'grad_approval_resolve',
    description:
      'Resolve an approval request for an external side effect. ALWAYS show the user the summary/preview first; approve or reject strictly on their explicit decision. Approving resumes the parked workflow run.',
    parameters: {
      approvalId: { type: 'string', required: true },
      decision: { type: 'string', enum: ['approved', 'rejected'], required: true },
    },
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        approvalStatus: { type: 'string' },
        runStatus: { type: 'string', description: 'Workflow run status after resuming (when bound to a run)' },
      },
      ['ok', 'approvalStatus'],
    ),
    async execute(args) {
      const a = args as { approvalId: string; decision: 'approved' | 'rejected' }
      const approval = services.approvals.resolve(a.approvalId, a.decision)
      let runStatus: string | undefined
      if (approval.workflowRunId) {
        const run = await services.workflows.resume(approval.workflowRunId)
        runStatus = run.status
      }
      return { ok: true, approvalStatus: approval.status, ...(runStatus ? { runStatus } : {}) }
    },
  })

  return [capture, runWorkflow, getRun, listRuns, approvalGet, approvalResolve]
}
