import type { IncomingMessage, ServerResponse } from 'node:http'

export const MAX_BODY_BYTES = 64 * 1024

export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('body-too-large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Wrap a route handler so thrown errors become structured JSON responses. */
export function routeErrors(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string })?.code ?? 'INTERNAL'
      if (!res.headersSent) json(res, 500, { ok: false, error: code, message })
      else res.end()
    }
  }
}
