/**
 * Atomic skill catalog — the units Skill Studio composes into recipes.
 * Each skill declares a machine-readable manifest (typed-ish inputs/outputs,
 * required tools, approval policy) mirroring its skill.yaml on disk, plus an
 * executable bound to host services.
 */

import type { HostServices } from '../services/index.ts'
import type { WorkflowStepContext } from '../services/workflow-engine.ts'
import type { CreateApprovalInput } from '../services/approval-service.ts'

export interface SkillManifest {
  id: string
  version: string
  title: string
  description: string
  /** Required input keys (validated against available context before running). */
  requiredInputs: string[]
  /** Output keys produced (advertised to later recipe steps). */
  outputs: string[]
  /** Whether executing this skill performs an external side effect. */
  externalSideEffect: boolean
  requiredTools: string[]
}

export interface SkillRunContext extends WorkflowStepContext {
  services: HostServices
}

export interface SkillDefinition {
  manifest: SkillManifest
  /** Derive the canonical external action from step input (gate + execute share it). */
  buildAction?(input: unknown): unknown
  /** Build the engine step for this skill. Returns the approval specs when the
   * skill has external side effects (the workflow gate handles consumption). */
  requiresApprovals?(input: unknown): Array<CreateApprovalInput>
  execute(input: unknown, ctx: SkillRunContext): Promise<unknown> | unknown
}

function makeSkills(services: HostServices): Record<string, SkillDefinition> {
  const researchRadar: SkillDefinition = {
    manifest: {
      id: 'academic-retrieval',
      version: '0.1.0',
      title: 'Academic retrieval (latest papers)',
      description: 'Collects the latest unique papers on a topic via provider layer with dedup.',
      requiredInputs: ['topic'],
      outputs: ['collectionId', 'delivered', 'complete'],
      externalSideEffect: false,
      requiredTools: ['grad_research_latest'],
    },
    async execute(input) {
      const a = input as { topic?: string; count?: number; since?: string }
      const collection = await services.research.latest({ topic: String(a.topic ?? ''), count: a.count ?? 50, since: a.since })
      return {
        collectionId: collection.id,
        delivered: collection.papers.length,
        requested: collection.requestedCount,
        complete: collection.complete,
        note: collection.notes,
      }
    },
  }

  const synthesis: SkillDefinition = {
    manifest: {
      id: 'literature-synthesis',
      version: '0.1.0',
      title: 'Cited literature synthesis (deterministic)',
      description: 'Renders an evidence-tagged Markdown report from a stored paper collection.',
      requiredInputs: ['collectionId'],
      outputs: ['reportArtifactId', 'reportWarnings'],
      externalSideEffect: false,
      requiredTools: ['grad_research_synthesize'],
    },
    execute(input, ctx) {
      const collectionId = (input as { collectionId?: string }).collectionId
      if (!collectionId) throw new Error('literature-synthesis requires collectionId from a previous step')
      ctx.recordToolCall('artifact.write_markdown', true)
      const result = services.research.synthesizeToArtifact(collectionId)
      return { reportArtifactId: result.artifactId, reportWarnings: result.warnings }
    },
  }

  const feishuPublish: SkillDefinition = {
    manifest: {
      id: 'feishu-publish-doc',
      version: '0.1.0',
      title: 'Feishu document publish (approval-gated)',
      description: 'Creates a Feishu document from Markdown content behind an explicit user approval.',
      requiredInputs: ['markdown'],
      outputs: ['published', 'externalRef'],
      externalSideEffect: true,
      requiredTools: ['grad_feishu_prepare_publish'],
    },
    // Both gate and execute derive the SAME action object so the stored
    // approval payload hash matches what is executed.
    buildAction(input) {
      return {
        type: 'doc.create' as const,
        title: String((input as { title?: string }).title ?? 'Graduate OS export'),
        markdown: String((input as { markdown?: string }).markdown ?? ''),
      }
    },
    requiresApprovals(input) {
      const action = this.buildAction!(input) as { type: 'doc.create'; title: string; markdown: string }
      return [
        {
          actionType: 'feishu.doc.create',
          summary: `Create Feishu document "${action.title}"`,
          payload: action,
          destination: 'Feishu Docs',
        },
      ]
    },
    async execute(input, ctx) {
      ctx.recordToolCall('feishu.publish', true)
      const action = this.buildAction!(input) as { type: 'doc.create'; title: string; markdown: string }
      const approvals = services.approvals.list({ workflowRunId: ctx.runId })
      const mine = approvals.find((x) => x.stepId === ctx.stepId && x.status === 'consumed')
      if (!mine) throw new Error('approval gate did not consume the publish approval')
      const result = await services.connectors.require('feishu').execute(action, { approval: mine })
      return { published: result.ok, ...(result.error ? { error: result.error } : {}), ...(result.externalRef ? { externalRef: result.externalRef } : {}) }
    },
  }

  const memoryNote: SkillDefinition = {
    manifest: {
      id: 'memory-note',
      version: '0.1.0',
      title: 'Save a confirmed memory note',
      description: 'Stores a short note into scoped memory as user-confirmed fact.',
      requiredInputs: ['note'],
      outputs: ['memoryId'],
      externalSideEffect: false,
      requiredTools: ['grad_memory_remember'],
    },
    execute(input) {
      const note = String((input as { note?: string }).note ?? '').trim()
      if (!note) throw new Error('memory-note requires note text')
      const item = services.memory.remember({ content: note, sourceType: 'workflow', userConfirmed: true })
      return { memoryId: item.id }
    },
  }

  return {
    'academic-retrieval': researchRadar,
    'literature-synthesis': synthesis,
    'feishu-publish-doc': feishuPublish,
    'memory-note': memoryNote,
  }
}

export function createSkillCatalog(services: HostServices): Record<string, SkillDefinition> {
  return makeSkills(services)
}
