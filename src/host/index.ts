import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dataLayout, resolveDataDir } from './env.ts'
import { openDatabase } from './services/db.ts'
import { makeRoutes } from './routes/index.ts'
import { makePingTool, setToolVersion } from './tools/ping.ts'
import type { GradHostContext } from './types.ts'

const PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url))
const VERSION: string = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version ?? '0.0.0'

/**
 * cordis services this plugin waits for. The primary deployment is the
 * dedicated `grad` WEB profile (dsh-base provides both services).
 * Headless profiles override this per-profile via a loader patch row
 * (`- id: dsh-grad-workbench / inject: [tools]`) because they have no HTTP
 * layer; see scripts/smoke.mjs and docs/COMPATIBILITY.md.
 */
export const inject = ['webServer', 'tools'] as const

/** Access an optionally-injected service; cordis throws on undeclared reads. */
function optional<T>(getter: () => T | undefined): T | undefined {
  try {
    return getter()
  } catch {
    return undefined
  }
}

/**
 * Graduate OS / 硕博工作台 host half.
 * Host owns DB, artifacts, workflow execution, approvals and memory.
 */
export function apply(ctx: GradHostContext): void {
  setToolVersion(VERSION)

  ctx.effect(() => {
    const layout = dataLayout(resolveDataDir())
    const startedAt = new Date().toISOString()

    // Database — canonical local state.
    const { db, appliedMigrations } = openDatabase({ layout })

    const disposers: Array<() => void> = []

    // HTTP surface for the client projection (web profiles only).
    const webServer = optional(() => ctx.webServer)
    if (webServer) {
      disposers.push(
        ...makeRoutes({ version: VERSION, layout, database: { db, appliedMigrations }, startedAt }).map((route) =>
          webServer.register(route),
        ),
      )
    }

    // Native-agent tools.
    disposers.push(...[makePingTool()].map((tool) => ctx.tools.register(tool)))

    ctx.logger.info(
      '[dsh-grad-workbench] mounted v%s (data: %s, http: %s)',
      VERSION,
      layout.root,
      webServer ? 'yes' : 'no',
    )

    return () => {
      for (const dispose of disposers) dispose()
      db.close()
    }
  }, 'dsh-grad-workbench: host')
}

export const INTERNAL_API_PREFIX = '/api/grad'
