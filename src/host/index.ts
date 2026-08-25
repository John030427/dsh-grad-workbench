import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dataLayout, resolveDataDir } from './env.ts'
import { buildServices } from './services/index.ts'
import { makeRoutes } from './routes/index.ts'
import { registerFoundationTools, setToolVersion } from './tools/foundation.ts'
import { ECHO_DEMO_WORKFLOW } from './workflows.ts'
import type { GradHostContext } from './types.ts'

const PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url))
const VERSION: string = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version ?? '0.0.0'

/**
 * cordis services this plugin waits for. Only `tools` (from dsh-base) is
 * REQUIRED — it exists in both web and headless profiles. `webServer` must NOT
 * be declared: declaring it would park the plugin forever in headless profiles
 * that have no HTTP layer. Instead the guarded accessor below reads it — cordis
 * resolves provided services up the fiber chain even when undeclared, and
 * throws only when absent, which the guard catches. Verified both ways on
 * rc.2 (see docs/COMPATIBILITY.md).
 */
export const inject = ['tools'] as const

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
    const services = buildServices(layout)

    // Built-in workflows (real vertical slices register here too).
    const unregisterWorkflows = [services.workflows.register(ECHO_DEMO_WORKFLOW)]

    const disposers: Array<() => void> = []

    // HTTP surface for the client projection (web profiles only).
    const webServer = optional(() => ctx.webServer)
    if (webServer) {
      disposers.push(
        ...makeRoutes({ version: VERSION, layout, services, startedAt }).map((route) => webServer.register(route)),
      )
    }

    // Native-agent tools.
    disposers.push(...registerFoundationTools(ctx.tools, services))

    ctx.logger.info(
      '[dsh-grad-workbench] mounted v%s (data: %s, http: %s)',
      VERSION,
      layout.root,
      webServer ? 'yes' : 'no',
    )

    return () => {
      for (const dispose of [...disposers, ...unregisterWorkflows]) dispose()
      services.close()
    }
  }, 'dsh-grad-workbench: host')
}

export const INTERNAL_API_PREFIX = '/api/grad'
