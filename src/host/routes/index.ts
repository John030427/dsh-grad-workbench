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

    // ── research ─────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/research/collections`, routeErrors(async (req, res) => {
      if (req.method === 'GET') {
        return void json(res, 200, { ok: true, collections: services.research.list() })
      }
      if (req.method === 'POST') {
        const body = (await readJsonBody(req)) as { topic?: string; count?: number; since?: string }
        if (!body.topic) return void json(res, 400, { ok: false, error: 'topic-required' })
        const collection = await services.research.latest({
          topic: body.topic,
          count: body.count,
          since: body.since,
        })
        return void json(res, 200, {
          ok: true,
          collectionId: collection.id,
          delivered: collection.papers.length,
          requested: collection.requestedCount,
          complete: collection.complete,
          note: collection.notes,
          papers: collection.papers.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors.slice(0, 4),
            year: p.year,
            venue: p.venue,
            citationCount: p.citationCount,
            evidenceLevel: p.evidenceLevel,
          })),
        })
      }
      json(res, 405, { ok: false, error: 'method-not-allowed' })
    })),
    {
      kind: 'prefix',
      path: `${API_PREFIX}/research/collections`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'POST') {
          return void json(res, 405, { ok: false, error: 'method-not-allowed' })
        }
        const suffix = pathnameSuffix(req, `${API_PREFIX}/research/collections/`)
        const [id, action] = suffix.split('/')
        if (!id) return void json(res, 400, { ok: false, error: 'collection-id-required' })

        if (!action && req.method === 'GET') {
          const collection = services.research.get(id!)
          return void json(res, 200, { ok: true, found: Boolean(collection), ...(collection ? { collection } : {}) })
        }
        if (action === 'synthesize' && req.method === 'POST') {
          const result = services.research.synthesizeToArtifact(id!)
          return void json(res, 200, { ok: true, ...result })
        }
        json(res, 404, { ok: false, error: 'not-found' })
      }),
    },

    // ── connectors ───────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/connectors`, routeErrors(async (req, res) => {
      if (req.method !== 'GET') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
      const healths = await services.connectors.healthAll()
      const byId = new Map(healths.map((h) => [h.id, h.health]))
      json(res, 200, {
        ok: true,
        connectors: services.connectors.list().map((c) => ({
          ...c,
          healthy: byId.get(c.id)?.ok ?? false,
          reason: byId.get(c.id)?.reason,
        })),
      })
    })),

    // ── communication ────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/communication/understand`, routeErrors(async (req, res) => {
      if (req.method !== 'POST') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
      const body = (await readJsonBody(req)) as { text?: string }
      if (!body.text) return void json(res, 400, { ok: false, error: 'text-required' })
      json(res, 200, { ok: true, understanding: services.communication.understand(body.text) })
    })),
    exact(`${API_PREFIX}/communication/draft`, routeErrors(async (req, res) => {
      if (req.method !== 'POST') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
      const body = (await readJsonBody(req)) as { originalText?: string; myUpdate?: string }
      if (!body.originalText) return void json(res, 400, { ok: false, error: 'originalText-required' })
      const result = services.communication.draft({
        originalText: body.originalText,
        userFacts: body.myUpdate,
      })
      const saved = services.communication.saveDraft({
        originalText: body.originalText,
        markdown: result.drafts[0]!.markdown,
      })
      json(res, 200, { ok: true, drafts: result.drafts, contextUsed: result.contextUsed, artifactId: saved.artifactId })
    })),

    // ── memory ───────────────────────────────────────────────────────────────
    exact(`${API_PREFIX}/memory`, routeErrors(async (req, res) => {
      if (req.method === 'GET') {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const q = url.searchParams.get('q')
        if (q) {
          const results = services.memory.search({ query: q, limit: 30, includeOutdated: true })
          return void json(res, 200, {
            ok: true,
            results: results.map((r) => ({ ...r.item, why: r.why, ageDays: r.ageDays })),
          })
        }
        return void json(res, 200, { ok: true, items: services.memory.list({ limit: 100 }) })
      }
      if (req.method === 'POST') {
        const body = (await readJsonBody(req)) as { content?: string; kind?: string }
        if (!body.content) return void json(res, 400, { ok: false, error: 'content-required' })
        const item = services.memory.remember({
          content: body.content,
          kind: body.kind as never,
          sourceType: 'user',
          userConfirmed: true,
        })
        return void json(res, 201, { ok: true, item })
      }
      json(res, 405, { ok: false, error: 'method-not-allowed' })
    })),
    {
      kind: 'prefix',
      path: `${API_PREFIX}/memory`,
      handler: routeErrors(async (req, res) => {
        if (req.method !== 'POST') return void json(res, 405, { ok: false, error: 'method-not-allowed' })
        const suffix = pathnameSuffix(req, `${API_PREFIX}/memory/`)
        const [id, action] = suffix.split('/')
        if (!id || !action) return void json(res, 400, { ok: false, error: 'memory-id-and-action-required' })
        switch (action) {
          case 'confirm':
            json(res, 200, { ok: true, item: services.memory.confirm(id!) })
            break
          case 'pin': {
            const item = services.memory.get(id!)
            json(res, 200, { ok: true, item: services.memory.setPinned(id!, !(item.pinned ?? false)) })
            break
          }
          case 'delete':
            services.memory.delete(id!)
            json(res, 200, { ok: true })
            break
          default:
            json(res, 404, { ok: false, error: 'not-found' })
        }
      }),
    },
  ]
}

function pathnameSuffix(req: import('node:http').IncomingMessage, prefix: string): string {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (!pathname.startsWith(prefix)) return ''
  return decodeURIComponent(pathname.slice(prefix.length))
}
