import { test } from 'node:test'
import assert from 'node:assert/strict'

// Unit-test TypeScript sources directly (Node 24 native type stripping).
const { vString, vObject, vArray, vNumber, vOptional, vIsoTimestamp } = await import('../../src/shared/validate.ts')
const { errors, GradError, isGradError } = await import('../../src/shared/errors.ts')

test('vString enforces type, enum, bounds', () => {
  const s = vString({ min: 1, max: 4 })
  assert.equal(s('abc'), 'abc')
  assert.throws(() => s(42), GradError)
  assert.throws(() => s(''), /length >= 1/)
  assert.throws(() => s('toolong'), /length <= 4/)
  const e = vString({ enum: ['a', 'b'] })
  assert.equal(e('a'), 'a')
  assert.throws(() => e('c'), /one of/)
})

test('vNumber enforces integer/min/max', () => {
  const n = vNumber({ integer: true, min: 0, max: 10 })
  assert.equal(n(5), 5)
  assert.throws(() => n(5.5), /integer/)
  assert.throws(() => n(-1), />= 0/)
})

test('vObject rejects unknown fields and validates nested paths', () => {
  const shape = vObject({ name: vString(), count: vOptional(vNumber({ min: 0 })) })
  assert.deepEqual(shape({ name: 'x' }), { name: 'x', count: undefined })
  assert.throws(() => shape({ name: 'x', extra: 1 }), /extra: unknown field/)
  assert.throws(() => shape({}), /name: expected string/)
  assert.throws(() => shape('nope'), /expected object/)
})

test('vArray maps item validators with index paths', () => {
  const a = vArray(vIsoTimestamp)
  const out = a(['2026-01-01T00:00:00Z'])
  assert.equal(out.length, 1)
  assert.throws(() => a(['nope']), /value\[0\]/)
  assert.throws(() => a('x'), /expected array/)
})

test('errors carry codes and retryability for actionable UI messages', () => {
  const err = errors.rateLimited('openalex', 1200)
  assert.ok(isGradError(err))
  assert.equal(err.code, 'RATE_LIMITED')
  assert.equal(err.retryable, true)
  assert.equal(err.detail.provider, 'openalex')
  const plain = new Error('plain')
  assert.equal(isGradError(plain), false)
})
