/**
 * Built-in workflows. Real vertical slices register here alongside the
 * foundation echo demo.
 */

import { errors } from '../shared/errors.ts'
import type { HostServices } from './services/index.ts'
import type { WorkflowDefinition } from './services/workflow-engine.ts'

export const ECHO_DEMO_WORKFLOW: WorkflowDefinition = {
  id: 'echo-demo',
  version: '0.1.0',
  title: 'Echo Demo — foundation proof workflow',
  description:
    'Normalizes a message into an artifact, then "publishes" it behind an approval gate. Used by tests and as the reference for real vertical slices.',
  validateInput(input) {
    if (typeof input !== 'object' || input === null || typeof (input as { message?: unknown }).message !== 'string') {
      throw errors.invalidInput('echo-demo requires input { message: string }')
    }
    return input
  },
  steps: [
    {
      name: 'normalize',
      skillId: 'echo-normalize',
      execute(input) {
        const message = (input as { message: string }).message
        return { normalized: message.trim(), length: message.trim().length }
      },
    },
    {
      name: 'publish-echo',
      skillId: 'echo-publish',
      requiresApprovals(input) {
        return [
          {
            actionType: 'demo.external_write',
            summary: 'Write echo report artifact (demo external-write stand-in)',
            payload: input,
            destination: 'local artifact store',
          },
        ]
      },
      async execute(input, ctx) {
        ctx.recordToolCall('artifact.write_markdown', true)
        const artifact = ctx.artifacts.put({
          kind: 'generic',
          mediaType: 'text/markdown',
          bytes: `# Echo Report\n\n- message: ${(input as { normalized: string }).normalized}\n- run: ${ctx.runId}\n- step: ${ctx.stepId}\n`,
          workflowRunId: ctx.runId,
        })
        return { artifactId: artifact.id }
      },
    },
  ],
}

/** Literature radar + approved Feishu publish: the full VS1 chain. */
export function makeLiteratureToFeishuWorkflow(services: HostServices): WorkflowDefinition {
  const radar = makeLiteratureRadarWorkflow(services)
  return {
    id: 'literature-to-feishu',
    version: '0.1.0',
    title: 'Latest papers → cited report → Feishu publish (approved)',
    description:
      'Runs the research radar, then publishes the cited Markdown report as a new Feishu document — ONLY after the user approves the publish preview.',
    validateInput(input) {
      if (typeof input !== 'object' || input === null || typeof (input as { topic?: unknown }).topic !== 'string') {
        throw errors.invalidInput('literature-to-feishu requires input { topic: string, count?: number, since?: string }')
      }
      return input
    },
    steps: [
      radar.steps[0], // build-collection
      radar.steps[1], // synthesize-report
      {
        name: 'publish-to-feishu',
        skillId: 'feishu-publish',
        requiresApprovals(input) {
          const action = buildPublishAction(services, input)
          return [
            {
              actionType: 'feishu.publish',
              summary: `Publish "${action.title}" to Feishu Docs`,
              payload: action,
              destination: 'Feishu Docs',
            },
          ]
        },
        async execute(input, ctx) {
          ctx.recordToolCall('feishu.publish', true)
          const action = buildPublishAction(services, input)
          // The workflow gate already consumed this run's approvals; find it.
          const approvals = services.approvals.list({ workflowRunId: ctx.runId })
          const mine = approvals.find((a) => a.stepId === ctx.stepId && a.status === 'consumed')
          if (!mine) throw errors.approvalRequired('feishu.publish')
          const result = await services.connectors.require('feishu').execute(action, { approval: mine })
          if (!result.ok) return { published: false, error: result.error }
          return { published: true, externalRef: result.externalRef }
        },
      },
    ],
  }
}

/** Identical construction in requiresApprovals and execute → stable payload hash. */
function buildPublishAction(
  services: HostServices,
  input: unknown,
): { type: 'doc.create'; title: string; markdown: string } {
  const reportArtifactId = (input as { reportArtifactId?: string }).reportArtifactId
  if (!reportArtifactId) throw errors.workflowState('unknown', 'synthesize-report', 'publish')
  const { text } = services.artifacts.readText(reportArtifactId)
  return {
    type: 'doc.create',
    title: `Literature report — collection ${reportArtifactId.slice(0, 8)}`,
    markdown: text,
  }
}
export function makeLiteratureRadarWorkflow(services: HostServices): WorkflowDefinition {
  return {
    id: 'literature-radar',
    version: '0.1.0',
    title: 'Latest Literature Radar → cited Markdown report',
    description:
      'Queries academic providers for recent papers on a topic, dedupes canonical identities, ranks, and renders a deterministic evidence-tagged Markdown report. Produces local artifacts only — external publishing is a separate approved step.',
    validateInput(input) {
      if (typeof input !== 'object' || input === null || typeof (input as { topic?: unknown }).topic !== 'string') {
        throw errors.invalidInput('literature-radar requires input { topic: string, count?: number, since?: string }')
      }
      return input
    },
    steps: [
      {
        name: 'build-collection',
        skillId: 'academic-retrieval',
        async execute(input, ctx) {
          const a = input as { topic: string; count?: number; since?: string }
          ctx.recordToolCall('academic.search', true)
          const collection = await services.research.latest({ topic: a.topic, count: a.count ?? 50, since: a.since })
          return {
            collectionId: collection.id,
            delivered: collection.papers.length,
            requested: collection.requestedCount,
            complete: collection.complete,
            note: collection.notes,
          }
        },
      },
      {
        name: 'synthesize-report',
        skillId: 'literature-synthesis',
        execute(input, ctx) {
          const collectionId = (input as { collectionId?: string }).collectionId
          if (!collectionId) throw errors.workflowState('unknown', 'build-collection', 'synthesize')
          ctx.recordToolCall('artifact.write_markdown', true)
          const result = services.research.synthesizeToArtifact(collectionId)
          return { reportArtifactId: result.artifactId, warnings: result.warnings }
        },
      },
    ],
  }
}
