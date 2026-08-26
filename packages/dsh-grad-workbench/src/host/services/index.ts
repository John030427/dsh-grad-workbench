import type { DataLayout } from '../env.ts'
import { openDatabase, type GradDatabase } from './db.ts'
import { ArtifactStore } from './artifact-store.ts'
import { ApprovalService } from './approval-service.ts'
import { WorkflowEngine } from './workflow-engine.ts'
import { CaptureService } from './capture-service.ts'
import { MemoryService } from './memory-service.ts'
import { CommunicationService } from './communication-service.ts'
import { FoodService } from './food-service.ts'
import { LedgerService } from './ledger-service.ts'
import { FormService } from './form-service.ts'
import { SkillStudioService } from './skill-studio.ts'
import { AudioBriefService } from './audio-brief.ts'
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
  communication: CommunicationService
  food: FoodService
  ledger: LedgerService
  forms: FormService
  studio: SkillStudioService
  audio: AudioBriefService
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
  const communication = new CommunicationService(artifacts, memory)
  const food = new FoodService(db)
  const ledger = new LedgerService(db)
  const forms = new FormService(db)
  const research = new ResearchService(db, layout, artifacts)
  const audio = new AudioBriefService(artifacts)
  const connectors = new ConnectorRegistry()
  connectors.register(new FeishuCliConnector(db))
  const studio = new SkillStudioService({
    database,
    artifacts,
    approvals,
    workflows,
    captures,
    memory,
    communication,
    food,
    ledger,
    forms,
    studio: undefined as never,
    audio,
    research,
    connectors,
    close: () => {},
  })

  return {
    database,
    artifacts,
    approvals,
    workflows,
    captures,
    memory,
    communication,
    food,
    ledger,
    forms,
    studio,
    audio,
    research,
    connectors,
    close() {
      db.close()
    },
  }
}
