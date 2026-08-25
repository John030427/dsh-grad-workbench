import type { DataLayout } from '../env.ts'
import { openDatabase, type GradDatabase } from './db.ts'
import { ArtifactStore } from './artifact-store.ts'
import { ApprovalService } from './approval-service.ts'
import { WorkflowEngine } from './workflow-engine.ts'
import { CaptureService } from './capture-service.ts'
import { MemoryService } from './memory-service.ts'
import { ResearchService } from '../research/index.ts'
import { ConnectorRegistry } from '../connectors/registry.ts'
import { FeishuCliConnector } from '../connectors/feishu.ts'

export interface HostServices {
  database: GradDatabase
  artifacts: ArtifactStore
  approvals: ApprovalService
  workflows: WorkflowEngine
  captures: CaptureService
  memory: MemoryService
  research: ResearchService
  connectors: ConnectorRegistry
  close(): void
}

export function buildServices(layout: DataLayout): HostServices {
  const database = openDatabase({ layout })
  const { db } = database
  const artifacts = new ArtifactStore(db, layout.artifactsDir)
  const approvals = new ApprovalService(db)
  const workflows = new WorkflowEngine(db, approvals, artifacts)
  const captures = new CaptureService(db)
  const memory = new MemoryService(db)
  const research = new ResearchService(db, layout, artifacts)

  const connectors = new ConnectorRegistry()
  connectors.register(new FeishuCliConnector(db))

  return {
    database,
    artifacts,
    approvals,
    workflows,
    captures,
    memory,
    research,
    connectors,
    close() {
      db.close()
    },
  }
}
