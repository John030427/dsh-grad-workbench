/**
 * Academic provider layer: HTTP client with disk cache + retry/backoff, and
 * the provider interface. Real-network failures (rate limits, outages) surface
 * as GradError('RATE_LIMITED'|'PROVIDER_FAILURE') — callers show partial state
 * honestly instead of fabricating results.
 */

import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Paper } from '../../shared/contracts.ts'

export const MAILTO = 'grad-workbench@example.com'

export interface FetchOptions {
  cacheDir?: string
  timeoutMs?: number
  retries?: number
  bypassCache?: boolean
}

/** GET JSON with sha256-keyed disk cache and exponential backoff on 429/5xx. */
export async function fetchJsonCached<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const cacheKey = createHash('sha256').update(url).digest('hex')
  const cachePath = opts.cacheDir ? join(opts.cacheDir, `${cacheKey}.json`) : undefined
  if (cachePath && !opts.bypassCache && existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf8')) as T
  }

  const timeoutMs = opts.timeoutMs ?? 20_000
  const retries = opts.retries ?? 2
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': `dsh-grad-workbench (mailto:${MAILTO})` },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`)
        if (attempt < retries) {
          const retryAfter = Number(res.headers.get('retry-after'))
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 2 ** attempt * 1500
          await new Promise((r) => setTimeout(r, wait))
          continue
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as T
      if (cachePath) {
        mkdirSync(opts.cacheDir!, { recursive: true })
        writeFileSync(cachePath, JSON.stringify(data))
      }
      return data
    } catch (err) {
      lastError = err
      if (attempt < retries && !(err instanceof Error && err.name === 'TimeoutError')) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1500))
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export interface AcademicQuery {
  topic: string
  /** ISO date or year; providers translate. */
  since?: string
  target: number
  poolFactor?: number
}

export interface AcademicSearchPage {
  papers: Paper[]
  totalEstimate?: number
  /** Provider-level notes (rate limits, partial coverage) for honest reporting. */
  note?: string
}

export interface AcademicProvider {
  readonly id: string
  search(query: AcademicQuery): Promise<AcademicSearchPage>
}
