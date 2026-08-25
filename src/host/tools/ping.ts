import { resolveDataDir } from '../env.ts'
import { defineGradTool, objectSchema } from './define.ts'
import type { ToolDefinition } from '../types.ts'

export function makePingTool(): ToolDefinition {
  return defineGradTool({
    name: 'grad_ping',
    description:
      'Health check for the Graduate OS (dsh-grad-workbench) plugin. Returns plugin version and the local data directory. Use to verify the workbench host half is alive.',
    parameters: {},
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        plugin: { type: 'string' },
        version: { type: 'string' },
        dataDir: { type: 'string', description: 'Local-first data root for the workbench' },
      },
      ['ok', 'plugin', 'version', 'dataDir'],
    ),
    execute() {
      return Promise.resolve({
        ok: true,
        plugin: 'dsh-grad-workbench',
        version: PLUGIN_VERSION,
        dataDir: resolveDataDir(),
      })
    },
  })
}

let PLUGIN_VERSION = '0.0.0'
export function setToolVersion(version: string): void {
  PLUGIN_VERSION = version
}
