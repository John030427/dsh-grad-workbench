/**
 * Built-in workflows. The echo demo proves the whole foundation chain:
 * run lifecycle → artifact creation → approval gate → resume/reject paths.
 */

import { errors } from '../shared/errors.ts'
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
