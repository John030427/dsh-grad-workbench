import type { JsonSchemaNode, TextContentBlock, ToolDefinition } from '../types.ts'

/**
 * Build a registry-ready ToolDefinition as a plain object (no runtime import of
 * @deepseek-ai/dsh-tools — see docs/COMPATIBILITY.md).
 */
export function defineGradTool<O>(opts: {
  name: string
  description: string
  parameters: Record<string, unknown>
  outputSchema: JsonSchemaNode
  execute: (args: unknown, exec: { signal?: AbortSignal }) => Promise<O> | O
}): ToolDefinition {
  return {
    name: opts.name,
    description: opts.description,
    parameters: opts.parameters,
    output: {
      schema: opts.outputSchema,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => opts.execute(args, exec),
  }
}

/** Convenience for object-shaped tool outputs. */
export function objectSchema(properties: Record<string, JsonSchemaNode>, required: string[]): JsonSchemaNode {
  return { type: 'object', properties, required, additionalProperties: false }
}
