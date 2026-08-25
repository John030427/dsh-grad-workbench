import type { DataLayout } from '../env.ts'
import type { HostServices } from '../services/index.ts'
import type { WebRoute } from '../types.ts'
import { json, readJsonBody, routeErrors } from '../http.ts'

export const API_PREFIX = '/api/grad'

export interface RouteDeps {
  version: string
  layout: DataLayout
  services: HostServices
  startedAt: string
}

export function makeRoutes(deps: RouteDeps): WebRoute[] {
  const { services } = deps
  const exact = (path: string, handler: WebRoute['handler']): WebRoute => ({
    kind: 'exact',
    path,
    handler: routeErrors(handler),
  })
  return [
    exact(`${API_PREFIX}/health`, (req, res) => {
      if (req.method !== 'GET') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
      json(res, 200, {
        ok: true,
        plugin: 'dsh-grad-workbench',
        version: deps.version,
        dataDir: deps.layout.root,
        migrations: deps.services.database.appliedMigrations(),
        workflows: services.workflows.listWorkflows(),
        startedAt: deps.startedAt,
        timestamp: Date.now(),
      })
    }),

    // ── captures ────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/captures`, async (req, res) => {
      if (req.method === 'GET') {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const status = url.searchParams.get('status') ?? undefined
        json(res, 200, { ok: true, captures: services.captures.list({ status: status as never }) })
        return
      }
      if (req.method === 'POST') {
        const body = (await readJsonBody(req)) as { text?: string; source?: string }
        if (typeof body.text !== 'string' || body.text.length === 0) {
          return void json(res, 400, { ok: false, error: 'text-required' })
        }
        const capture = services.captures.create({ text: body.text, source: (body.source as never) ?? 'dsh' })
        json(res, 201, { ok: true, capture })
        return
      }
      json(res, 405, { ok: false, error: 'method-not-allowed' })
    }),

    // ── workflows & runs ─────────────────────────────────────────────────────
    exact(`${API_PREFIX}/workflows`, (_req, res) => {
      json(res, 200, { ok: true, workflows: services.workflows.listWorkflows() })
    }),
    exact(`${API_PREFIX}/runs`, (req, res) => {
      if (req.method !== 'GET') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
      const url = new URL(req.url ?? '/', 'http://localhost')
      const status = url.searchParams.get('status') ?? undefined
      json(res, 200, { ok: true, runs: services.workflows.listRuns({ status: status as never }) })
    }),
    {
      kind: 'prefix',
      path: `${API_PREFIX}/runs`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== 'GET') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
        const runId = pathnameSuffix(req, `${API_PREFIX}/runs/`)
        const run = services.workflows.getRun(runId)
        json(res, 200, {
          ok: true,
          run,
          steps: services.workflows.getSteps(runId),
          approvals: services.approvals.list({ workflowRunId: runId }),
          artifacts: services.artifacts.list({ workflowRunId: runId }),
        })
      }),
    },
    {
      kind: 'prefix',
      path: `${API_PREFIX}/workflows`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== 'POST') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
        const workflowId = pathnameSuffix(req, `${API_PREFIX}/workflows/`).split('/')[0]!
        const body = await readJsonBody(req)
        try {
          const run = await services.workflows.start(workflowId, (body as { input?: unknown }).input ?? body)
          json(res, 202, { ok: true, run, steps: services.workflows.getSteps(run.id) })
        } catch (err) {
          const code = (err as { code?: string }).code
          const message = err instanceof Error ? err.message : String(err)
          if (code === 'NOT_FOUND') json(res, 404, { ok: false, error: message })
          else if (code === 'INVALID_INPUT') json(res, 400, { ok: false, error: message })
          else throw err
        }
      }),
    },

    // ── approvals ────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/approvals`, (req, res) => {
      if (req.method !== 'GET') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
      const url = new URL(req.url ?? '/', 'http://localhost')
      const status = url.searchParams.get('status') ?? undefined
      json(res, 200, { ok: true, approvals: services.approvals.list({ status: status as never }) })
    }),
    {
      kind: 'prefix',
      path: `${API_PREFIX}/approvals`,
      handler: routeErrors(async (req, res) => {
        const suffix = pathnameSuffix(req, `${API_PREFIX}/approvals/`)
        const [approvalId, action] = suffix.split('/')
        if (!approvalId) return void json(res, 400, { ok: false, error: 'approval-id-required' })

        if (action === undefined && req.method === 'GET') {
          return void json(res, 200, { ok: true, approval: services.approvals.get(approvalId!) })
        }
        if (action === 'resolve' && req.method === 'POST') {
          const body = (await readJsonBody(req)) as { decision?: string }
          if (body.decision !== 'approved' && body.decision !== 'rejected') {
            return void json(res, 400, { ok: false, error: 'decision must be approved|rejected' })
          }
          const approval = services.approvals.resolve(approvalId!, body.decision)
          let run = undefined
          if (approval.workflowRunId) {
            run = await services.workflows.resume(approval.workflowRunId)
          }
          return void json(res, 200, { ok: true, approval, run })
        }
        json(res, 404, { ok: false, error: 'not-found' })
      }),
    },

    // ── artifacts ────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/artifacts`, (req, res) => {
      if (req.method !== 'GET') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
      json(res, 200, { ok: true, artifacts: services.artifacts.list() })
    }),
    {
      kind: 'prefix',
      path: `${API_PREFIX}/artifacts`,
      handler: routeErrors((req, res) => {
        if (req.method !== 'GET') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
        const id = pathnameSuffix(req, `${API_PREFIX}/artifacts/`).split('/')[0]!
        const { meta, text } = services.artifacts.readText(id)
        json(res, 200, { ok: true, artifact: meta, content: text })
      }),
    },
  ]
}

function pathnameSuffix(req: import('node:http').IncomingMessage, prefix: string): string {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (!pathname.startsWith(prefix)) return ''
  return decodeURIComponent(pathname.slice(prefix.length))
}
