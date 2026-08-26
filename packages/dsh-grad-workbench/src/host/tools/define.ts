import type { JsonSchemaNode, TextContentBlock, ToolDefinition } from '../types.ts'

/**
 * Compile an author-facing ParameterSchemaSpec (per-property map annotated with
 * `required: true`) into the RAW JSON Schema object root the registry expects.
 * This mirrors what @deepseek-ai/dsh-tools' defineTool does internally —
 * register()/wire schemas consume compiled JSON Schema, not the author DSL.
 * See docs/COMPATIBILITY.md.
 */
export function compileParameters(spec: Record<string, Record<string, unknown>>): JsonSchemaNode {
  const properties: Record<string, JsonSchemaNode> = {}
  const required: string[] = []
  for (const [key, node] of Object.entries(spec)) {
    const { required: isRequired, ...rest } = node
    if (isRequired === true) required.push(key)
    properties[key] = stripAuthorAnnotations(rest) as JsonSchemaNode
  }
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    // Open root: models may add harmless extras; domain validators re-check.
    additionalProperties: true,
  }
}

function stripAuthorAnnotations(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node
  if (Array.isArray(node)) return node.map(stripAuthorAnnotations)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    out[k] = k === 'items' ? stripAuthorAnnotations(v)
      : k === 'properties' && typeof v === 'object' && v !== null
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, stripAuthorAnnotations(pv)]))
      : v
  }
  return out
}

/**
 * Deep-remove `undefined` values: the registry enforces lossless JSON on tool
 * outputs, and an explicit undefined property fails that check.
 */
export function toJsonLossless<T>(value: T): T {
  if (value === undefined) return null as unknown as T
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : toJsonLossless(v))) as unknown as T
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      out[k] = toJsonLossless(v)
    }
    return out as unknown as T
  }
  return value
}

/**
 * Build a registry-ready ToolDefinition as a plain object (no runtime import of
 * @deepseek-ai/dsh-tools — see docs/COMPATIBILITY.md).
 */
export function defineGradTool(opts: {
  name: string
  description: string
  /** Per-property spec map, e.g. { text: { type: 'string', required: true } }. */
  parameters: Record<string, Record<string, unknown>>
  /** Raw JSON Schema for the canonical output value. */
  outputSchema: JsonSchemaNode
  execute: (args: unknown, exec: { signal?: AbortSignal }) => Promise<unknown> | unknown
}): ToolDefinition {
  return {
    name: opts.name,
    description: opts.description,
    parameters: compileParameters(opts.parameters),
    output: {
      schema: opts.outputSchema,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => toJsonLossless(await opts.execute(args, exec)),
  }
}

/** Convenience for object-shaped tool outputs. */
export function objectSchema(properties: Record<string, JsonSchemaNode>, required: string[]): JsonSchemaNode {
  return { type: 'object', properties, required, additionalProperties: false }
}
