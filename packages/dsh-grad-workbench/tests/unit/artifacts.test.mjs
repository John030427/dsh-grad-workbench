import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { makeServiceStack } from '../helpers.mjs'

test('artifact store: stable id, sha256, run binding, delete', async () => {
  const s = await makeServiceStack()
  try {
    const ref = s.artifacts.put({
      kind: 'research-report',
      mediaType: 'text/markdown',
      bytes: '# Report\n\ncited synthesis body',
      workflowRunId: 'run-123',
      sourceRefs: [{ id: 'src-1', kind: 'url', ref: 'https://example.org/paper', createdAt: new Date().toISOString() }],
    })
    assert.ok(ref.id.length > 10)
    assert.equal(ref.sha256, createHash('sha256').update('# Report\n\ncited synthesis body').digest('hex'))
    assert.ok(existsSync(ref.path), 'file written under artifacts root')
    assert.ok(ref.path.includes(s.layout.artifactsDir), 'path inside data layout')

    const meta = s.artifacts.getMeta(ref.id)
    assert.equal(meta.kind, 'research-report')
    assert.equal(meta.workflowRunId, 'run-123')

    const { text } = s.artifacts.readText(ref.id)
    assert.ok(text.startsWith('# Report'))

    const listed = s.artifacts.list({ workflowRunId: 'run-123' })
    assert.equal(listed.length, 1)

    s.artifacts.delete(ref.id)
    assert.throws(() => s.artifacts.getMeta(ref.id), /not found/)
    assert.equal(s.artifacts.list({ workflowRunId: 'run-123' }).length, 0)

    // Unknown ids surface actionable errors.
    assert.throws(() => s.artifacts.getMeta('nope'), /not found/)
  } finally {
    s.cleanup()
  }
})

test('artifact store refuses textual read of binary media', async () => {
  const s = await makeServiceStack()
  try {
    const ref = s.artifacts.put({ kind: 'audio-file', mediaType: 'audio/mpeg', bytes: Buffer.from([0xff, 0xfb]) })
    assert.throws(() => s.artifacts.readText(ref.id), /not textual/)
  } finally {
    s.cleanup()
  }
})
