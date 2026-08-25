/** Composition root: build every host service from one database + layout. */

import type { DataLayout } from '../env.ts'
import { openDatabase, type GradDatabase } from './db.ts'
import { ArtifactStore } from './artifact-store.ts'
import { ApprovalService } from './approval-service.ts'
import { WorkflowEngine } from './workflow-engine.ts'
import { CaptureService } from './capture-service.ts'

export interface HostServices {
  database: GradDatabase
  artifacts: ArtifactStore
  approvals: ApprovalService
  workflows: WorkflowEngine
  captures: CaptureService
  close(): void
}

export function buildServices(layout: DataLayout): HostServices {
  const database = openDatabase({ layout })
  const { db } = database
  const artifacts = new ArtifactStore(db, layout.artifactsDir)
  const approvals = new ApprovalService(db)
  const workflows = new WorkflowEngine(db, approvals, artifacts)
  const captures = new CaptureService(db)
  return {
    database,
    artifacts,
    approvals,
    workflows,
    captures,
    close() {
      db.close()
    },
  }
}
