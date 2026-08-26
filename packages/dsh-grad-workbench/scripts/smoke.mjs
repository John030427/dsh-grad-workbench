#!/usr/bin/env node
/**
 * Post-boot smoke probe for the grad product profile.
 * Usage: node scripts/smoke.mjs [port]   (default 3101)
 * Expects a running `dsh --profile grad --port <port>` instance.
 */

const port = Number(process.argv[2] ?? 3101)
const base = `http://127.0.0.1:${port}`

let failures = 0
async function check(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (err) {
    failures++
    console.log(`FAIL ${name}: ${err.message}`)
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

await check('GET /api/grad/health → ok:true + migrations', async () => {
  const res = await fetch(`${base}/api/grad/health`)
  assert(res.ok, `status ${res.status}`)
  const body = await res.json()
  assert(body.ok === true, 'body.ok !== true')
  assert(body.plugin === 'dsh-grad-workbench', 'wrong plugin name')
  assert(Array.isArray(body.migrations) && body.migrations.length >= 1, 'no migrations applied')
})

await check('GET /plugins/@grad/dsh-grad-workbench/client.js → ModuleLoader bundle', async () => {
  const res = await fetch(`${base}/plugins/@grad/dsh-grad-workbench/client.js`)
  assert(res.ok, `status ${res.status}`)
  const text = await res.text()
  assert(text.includes('__ModuleLoader__'), 'bundle not wrapped for client module loader')
  assert(text.includes('硕博工作台') || text.length > 1000, 'bundle looks empty')
})

await check('GET /plugins/@grad/grad-shell/client.js → shell ModuleLoader bundle', async () => {
  const res = await fetch(`${base}/plugins/@grad/grad-shell/client.js`)
  assert(res.ok, `status ${res.status}`)
  const text = await res.text()
  assert(text.includes('__ModuleLoader__'), 'shell bundle not wrapped for client module loader')
  assert(text.includes('Graduate OS') || text.length > 1000, 'shell bundle looks empty')
})

await check('GET / → index served', async () => {
  const res = await fetch(`${base}/`)
  assert(res.ok, `status ${res.status}`)
})

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll smoke checks passed')