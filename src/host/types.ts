/**
 * Local DSH host contract types (structural, import-free).
 * Mirrors the verified rc.2 contracts documented in docs/COMPATIBILITY.md.
 * Plugins on this machine must not runtime-import @deepseek-ai/* packages;
 * everything arrives through the cordis context.
 */

export interface IDisposable {
  (): void
}

export interface HostLogger {
  info(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  error(msg: string, ...args: unknown[]): void
  debug(msg: string, ...args: unknown[]): void
}

export interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void | Promise<void>
}

export interface WebServerService {
  register(route: WebRoute): IDisposable
}

export interface SkillRegistration {
  name: string
  description: string
  whenToUse?: string
  source?: string
  provider?: string
  content: string
}

export interface SkillsService {
  register(skill: SkillRegistration): IDisposable
}

/** Content block as consumed by the model-facing render functions. */
export interface TextContentBlock {
  type: 'text'
  text: string
}

export type JsonSchemaNode = Record<string, unknown>

export interface ToolOutputDefinition {
  schema: JsonSchemaNode
  render(args: unknown, value: unknown): TextContentBlock[]
  presentationMeta?(args: unknown, value: unknown): unknown
}

export interface ToolRunContext {
  signal?: AbortSignal
  agent?: string
  [key: string]: unknown
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: ToolOutputDefinition
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>
  timeoutMs?: number
  isConcurrencySafe?(args: unknown): boolean
}

export interface ToolsService {
  register(definition: ToolDefinition): IDisposable
}

export interface GradHostContext {
  effect(setup: () => IDisposable | void, label?: string): void
  logger: HostLogger
  /** Present under web profiles only (absent in headless runs). */
  webServer?: WebServerService
  skills?: SkillsService
  tools: ToolsService
}
