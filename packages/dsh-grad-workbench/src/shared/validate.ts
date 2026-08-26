/**
 * Minimal hand-written runtime validators for data crossing trust boundaries.
 * Philosophy: small composable predicates that throw GradError('INVALID_INPUT')
 * with a path-qualified message. No external schema dependency.
 */

import { errors } from './errors.ts'

export type Validator<T> = (value: unknown, path?: string) => T

function fail(path: string, expected: string): never {
  throw errors.invalidInput(`${path}: expected ${expected}`)
}

export const vString =
  (opts: { min?: number; max?: number; enum?: readonly string[]; pattern?: RegExp } = {}): Validator<string> =>
  (value, path = 'value') => {
    if (typeof value !== 'string') fail(path, 'string')
    if (opts.enum && !opts.enum.includes(value)) fail(path, `one of ${opts.enum.map((e) => JSON.stringify(e)).join('|')}`)
    if (opts.min !== undefined && value.length < opts.min) fail(path, `string with length >= ${opts.min}`)
    if (opts.max !== undefined && value.length > opts.max) fail(path, `string with length <= ${opts.max}`)
    return value
  }

export const vOptional =
  <T>(inner: Validator<T>): Validator<T | undefined> =>
  (value, path = 'value') => {
    if (value === undefined || value === null) return undefined
    return inner(value, path)
  }

export const vNumber =
  (opts: { min?: number; max?: number; integer?: boolean } = {}): Validator<number> =>
  (value, path = 'value') => {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'finite number')
    if (opts.integer && !Number.isInteger(value)) fail(path, 'integer')
    if (opts.min !== undefined && value < opts.min) fail(path, `number >= ${opts.min}`)
    if (opts.max !== undefined && value > opts.max) fail(path, `number <= ${opts.max}`)
    return value
  }

export const vBoolean: Validator<boolean> = (value, path = 'value') => {
  if (typeof value !== 'boolean') fail(path, 'boolean')
  return value
}

export const vArray =
  <T>(item: Validator<T>, opts: { max?: number } = {}): Validator<T[]> =>
  (value, path = 'value') => {
    if (!Array.isArray(value)) fail(path, 'array')
    if (opts.max !== undefined && value.length > opts.max) fail(path, `array with length <= ${opts.max}`)
    return value.map((it, i) => item(it, `${path}[${i}]`))
  }

export function vObject<T>(
  shape: { [K in keyof T]: Validator<T[K]> },
  opts: { allowUnknown?: boolean } = {},
): Validator<T> {
  return (value, path = 'value') => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'object')
    const input = value as Record<string, unknown>
    if (!opts.allowUnknown) {
      const known = new Set(Object.keys(shape))
      for (const key of Object.keys(input)) {
        if (!known.has(key)) throw errors.invalidInput(`${path}.${key}: unknown field`)
      }
    }
    const out: Record<string, unknown> = {}
    for (const [key, validator] of Object.entries(shape)) {
      out[key] = (validator as Validator<unknown>)(input[key], `${path}.${key}`)
    }
    return out as T
  }
}

export const vIsoTimestamp: Validator<string> = (value, path = 'value') => {
  if (typeof value !== 'string') fail(path, 'ISO timestamp string')
  const t = Date.parse(value)
  if (Number.isNaN(t)) fail(path, 'parseable ISO timestamp')
  return value
}
