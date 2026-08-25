import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dataLayout, resolveDataDir } from './env.ts'
import { buildServices } from './services/index.ts'
import { makeRoutes } from './routes/index.ts'
import { registerFoundationTools, setToolVersion } from './tools/foundation.ts'
import { makeMemoryTools } from './tools/memory.ts'
import { makeResearchTools } from './tools/research.ts'
import { makeConnectorTools } from './tools/connectors.ts'
import { makeCommunicationTools } from './tools/communication.ts'
import { makeFoodTools } from './tools/food.ts'
import { makeLedgerTools } from './tools/ledger.ts'
import { makeFormTools } from './tools/form.ts'
import { ECHO_DEMO_WORKFLOW, makeLiteratureRadarWorkflow, makeLiteratureToFeishuWorkflow } from './workflows.ts'
import type { GradHostContext } from './types.ts'

const PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url))
const VERSION: string = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version ?? '0.0.0'

/**
 * cordis services this plugin waits for. Primary deployment: dedicated `grad`
 * WEB profile (dsh-base provides both services).
 *
 * Headless profiles have no HTTP layer, where waiting for `webServer` would
 * park forever. That case is handled OUTSIDE the code: the grad-headless
* profile's cordis.patch.yml disables this entry and re-inserts the same
 * package under an alias id with `inject: [tools]`. Undeclared service reads
 * are still wrapped in optional() so a mis-profile degrades instead of
 * crashing (verified rc.2 — see docs/COMPATIBILITY.md).
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
    const services = buildServices(layout)

    // Built-in workflows (real vertical slices register here too).
    const unregisterWorkflows = [
      services.workflows.register(ECHO_DEMO_WORKFLOW),
      services.workflows.register(makeLiteratureRadarWorkflow(services)),
      services.workflows.register(makeLiteratureToFeishuWorkflow(services)),
    ]

    const disposers: Array<() => void> = []

    // HTTP surface for the client projection (web profiles only).
    const webServer = optional(() => ctx.webServer)
    if (webServer) {
      disposers.push(
        ...makeRoutes({ version: VERSION, layout, services, startedAt }).map((route) => webServer.register(route)),
      )
    }

    // Native-agent tools.
    disposers.push(
      ...registerFoundationTools(ctx.tools, services),
      ...makeMemoryTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeResearchTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeConnectorTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeCommunicationTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeFoodTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeLedgerTools(services).map((tool) => ctx.tools.register(tool)),
      ...makeFormTools(services).map((tool) => ctx.tools.register(tool)),
    )

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
