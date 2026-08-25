import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Create an isolated data root for one test. Caller removes it when done. */
export function makeTempHome(prefix = 'grad-wb-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

function rmRf(path) {
  try {
    rmSync(path, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
}

/**
 * Build the full service stack on a temp home via direct TS imports
 * (Node 24 native type stripping; no bundling needed for unit tests).
 */
export async function makeServiceStack() {
  const home = makeTempHome()
  process.env.GRAD_WORKBENCH_HOME = home
  const { openDatabase } = await import('../src/host/services/db.ts')
  const { dataLayout } = await import('../src/host/env.ts')
  const { ArtifactStore } = await import('../src/host/services/artifact-store.ts')
  const { ApprovalService } = await import('../src/host/services/approval-service.ts')
  const { WorkflowEngine } = await import('../src/host/services/workflow-engine.ts')
  const { MemoryService } = await import('../src/host/services/memory-service.ts')
  const { FoodService } = await import('../src/host/services/food-service.ts')
  const { LedgerService } = await import('../src/host/services/ledger-service.ts')
  const { ResearchService } = await import('../src/host/research/index.ts')
  const { ConnectorRegistry } = await import('../src/host/connectors/registry.ts')
  const { FeishuCliConnector } = await import('../src/host/connectors/feishu.ts')
  const layout = dataLayout(home)
  const database = openDatabase({ layout })
  const artifacts = new ArtifactStore(database.db, layout.artifactsDir)
  const approvals = new ApprovalService(database.db)
  const workflows = new WorkflowEngine(database.db, approvals, artifacts)
  const memory = new MemoryService(database.db)
  const food = new FoodService(database.db)
  const ledger = new LedgerService(database.db)
  const research = new ResearchService(database.db, layout, artifacts)
  const connectors = new ConnectorRegistry()
  connectors.register(new FeishuCliConnector(database.db))
  return {
    home,
    layout,
    db: database.db,
    artifacts,
    approvals,
    workflows,
    memory,
    food,
    ledger,
    research,
    connectors,
    cleanup() {
      database.db.close()
      rmRf(home)
    },
  }
}



