import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'grad-wb-http-'))
process.env.GRAD_WORKBENCH_HOME = home

const host = await import('../../lib/index.js')

// ── mock host plumbing ──────────────────────────────────────────────────────

const record = { tools: [], routes: [] }
const ctx = {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  effect(setup) {
    setup()
  },
  webServer: {
    register: (route) => {
      record.routes.push(route)
      return () => {}
    },
  },
  skills: { register: () => () => {} },
  tools: {
    register: (tool) => {
      record.tools.push(tool)
      return () => {}
    },
  },
}
host.apply(ctx)

async function request(method, pathWithQuery, body) {
  const pathname = pathWithQuery.split('?')[0]
  const route = record.routes.find((r) =>
    r.kind === 'exact'
      ? r.path === pathname && (r.method === undefined || true)
      : pathname === r.path || pathname.startsWith(`${r.path}/`),
  )
  if (!route) throw new Error(`no route for ${method} ${pathWithQuery}`)
  if (!route) throw new Error(`no route for ${method} ${pathWithQuery}`)
  let state = { status: 0, text: '' }
  const res = {
    writeHead(status) {
      state.status = status
    },
    end(text) {
      state.text = text ?? ''
    },
    get headersSent() {
      return false
    },
  }
  const req = {
    method,
    url: pathWithQuery,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  }
  await route.handler(req, res)
  return { status: state.status, body: state.text ? JSON.parse(state.text) : undefined }
}

// ── the full foundation flow over HTTP ──────────────────────────────────────

test('health exposes workflows', async () => {
  const { status, body } = await request('GET', '/api/grad/health')
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.ok(body.workflows.some((w) => w.id === 'echo-demo'))
})

test('run → approval → approve → completed → artifact, all over HTTP', async () => {
  const start = await request('POST', '/api/grad/workflows/echo-demo/run', { input: { message: 'http flow' } })
  assert.equal(start.status, 202)
  assert.equal(start.body.run.status, 'waiting_approval')
  const runId = start.body.run.id

  const pending = await request('GET', '/api/grad/approvals?status=pending')
  assert.equal(pending.body.approvals.length, 1)
  const approvalId = pending.body.approvals[0].id

  const resolved = await request('POST', `/api/grad/approvals/${approvalId}/resolve`, { decision: 'approved' })
  assert.equal(resolved.body.approval.status, 'approved')
  assert.equal(resolved.body.run.status, 'completed')

  const detail = await request('GET', `/api/grad/runs/${runId}`)
  assert.equal(detail.body.run.status, 'completed')
  assert.equal(detail.body.artifacts.length, 1)
  assert.equal(detail.body.steps[1].status, 'completed')

  const artifactId = detail.body.artifacts[0].id
  const content = await request('GET', `/api/grad/artifacts/${artifactId}`)
  assert.ok(content.body.content.includes('http flow'))
})

test('rejecting an approval fails the run over HTTP', async () => {
  const start = await request('POST', '/api/grad/workflows/echo-demo/run', { input: { message: 'nope' } })
  const runId = start.body.run.id
  const pending = await request('GET', '/api/grad/approvals?status=pending')
  await request('POST', `/api/grad/approvals/${pending.body.approvals[0].id}/resolve`, { decision: 'rejected' })

  const detail = await request('GET', `/api/grad/runs/${runId}`)
  assert.equal(detail.body.run.status, 'failed')
  assert.match(detail.body.run.error, /approval rejected/)
})

test('captures create and list over HTTP', async () => {
  const created = await request('POST', '/api/grad/captures', { text: '帮我找最近一年关于 agent memory 的最新论文' })
  assert.equal(created.status, 201)
  assert.equal(created.body.capture.inferredIntent, 'research.literature-radar')

  const listed = await request('GET', '/api/grad/captures')
  assert.ok(listed.body.captures.length >= 1)
})

test('unknown workflow id returns 404 over HTTP', async () => {
  const res = await request('POST', '/api/grad/workflows/nope/run', {})
  assert.equal(res.status, 404)
})

test.after?.(() => {
  try {
    rmSync(home, { recursive: true, force: true })
  } catch {}
})
