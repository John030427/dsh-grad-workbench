import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = mkdtempSync(join(tmpdir(), 'grad-wb-'))
process.env.GRAD_WORKBENCH_HOME = dataDir

const host = await import('../../lib/index.js')

function mockCtx(record) {
  const services = {
    webServer: { register: (route) => { record.routes.push(route); return () => {} } },
    skills: { register: () => () => {} },
    tools: { register: (tool) => { record.tools.push(tool); return () => {} } },
  }
  return {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    effect(setup) {
      setup()
    },
    get webServer() { return services.webServer },
    skills: services.skills,
    tools: services.tools,
  }
}

function mockResponse() {
  const state = { status: 0, body: undefined, headers: null }
  return {
    get status() { return state.status },
    get body() { return state.body },
    writeHead(status, headers) { state.status = status; state.headers = headers },
    end(text) { state.body = text ? JSON.parse(text) : undefined },
  }
}

test('host entry exports the verified plugin contract', () => {
  assert.ok(Array.isArray(host.inject), 'inject must be an array of service names')
  assert.ok(host.inject.includes('tools'), 'inject must include tools (present in web + headless)')
  assert.ok(host.inject.includes('webServer'), 'inject must include webServer for the primary web profile')
  assert.equal(typeof host.apply, 'function', 'apply(ctx) must be a function')
})

// Headless profiles override inject to [tools] via a loader patch row; the
// runtime guard must then skip route registration instead of crashing.
class HeadlessCtx {
  constructor(record) { this.record = record }
  logger = { info() {}, warn() {}, error() {}, debug() {} }
  effect(setup) { setup() }
  get webServer() { throw new Error('cannot get property "webServer" without inject') }
  tools = { register: (tool) => { this.record.tools.push(tool); return () => {} } }
}

test('apply tolerates headless profiles where webServer is not injected', () => {
  const record = { tools: [], routes: [] }
  host.apply(new HeadlessCtx(record))
  assert.ok(record.tools.some((t) => t.name === 'grad_ping'), 'tool still registered without webServer')
  assert.equal(record.routes.length, 0)
})

test('grad_ping tool follows the registry ToolDefinition shape', async () => {
  const record = { tools: [], routes: [] }
  host.apply(mockCtx(record))
  const ping = record.tools.find((t) => t.name === 'grad_ping')
  assert.ok(ping, 'grad_ping registered')
  assert.equal(typeof ping.description, 'string')
  assert.deepEqual(ping.parameters, {})
  assert.equal(typeof ping.output.render, 'function', 'output.render must be a function')
  assert.equal(ping.output.schema.type, 'object')
  const value = await ping.execute({}, {})
  assert.equal(value.ok, true)
  assert.equal(value.plugin, 'dsh-grad-workbench')
  assert.ok(value.dataDir.startsWith(dataDir), `dataDir honors GRAD_WORKBENCH_HOME: ${value.dataDir}`)
  const rendered = ping.output.render({}, value)
  assert.equal(rendered[0].type, 'text')
})

test('apply registers the /api/grad/health route', async () => {
  const record = { tools: [], routes: [] }
  host.apply(mockCtx(record))
  const health = record.routes.find((r) => r.path === '/api/grad/health' && r.kind === 'exact')
  assert.ok(health, 'health route registered')
  const res = mockResponse()
  await health.handler({ method: 'GET' }, res)
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.plugin, 'dsh-grad-workbench')
  assert.ok(Array.isArray(res.body.migrations))
  assert.ok(res.body.migrations.length >= 1, 'migration 001 applied')
})

test('health route rejects non-GET methods', async () => {
  const record = { tools: [], routes: [] }
  host.apply(mockCtx(record))
  const health = record.routes.find((r) => r.path === '/api/grad/health')
  const res = mockResponse()
  await health.handler({ method: 'POST' }, res)
  assert.equal(res.status, 405)
})

test.after?.(() => {
  try { rmSync(dataDir, { recursive: true, force: true }) } catch {}
})
