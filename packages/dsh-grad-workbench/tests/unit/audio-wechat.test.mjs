import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceStack } from '../helpers.mjs'

const { AudioBriefService } = await import('../../src/host/services/audio-brief.ts')
const { normalizeInboundEnvelope, loadBridgeConfig } = await import('../../src/host/channels/wechat.ts')

test('audio brief: deterministic script with required sections; honest no-TTS state', async () => {
  const s = await makeServiceStack()
  try {
    const audio = new AudioBriefService(s.artifacts)
    const report = s.artifacts.put({
      kind: 'research-report',
      mediaType: 'text/markdown',
      bytes: '# Literature report — agent memory\n\n## 4. Major themes\n- Theme "episodic memory" appears in 6/10 papers\n\n## 9. What to read first\n1. A Survey of Memory in LLM Agents (2025)\n',
    })

    const brief = await audio.createBrief({ reportArtifactId: report.id })
    assert.equal(brief.audioAvailable, false, 'no TTS provider configured → honestly unavailable')
    assert.equal(brief.audioArtifactId, undefined)

    const { text } = s.artifacts.readText(brief.scriptArtifactId)
    for (const expected of ['开场', '范围与方法', '建议优先阅读', 'A Survey of Memory in LLM Agents']) {
      assert.ok(text.includes(expected), `script contains ${expected}`)
    }

    // Deterministic regeneration.
    const again = await audio.createBrief({ reportArtifactId: report.id })
    const t2 = s.artifacts.readText(again.scriptArtifactId).text
    assert.equal(t2, text)
    void s2_unused
    function s2_unused() {}
  } finally {
    s.cleanup()
  }
})

test('wechat: envelope normalization + feature flag stays OFF by default', async () => {
  const env = { ...process.env }
  delete env.GRAD_WECHAT_BRIDGE_URL
  const cfg = loadBridgeConfig(env)
  assert.equal(cfg.enabled, false, 'channel disabled without explicit bridge config')

  const envelope = normalizeInboundEnvelope({
    senderId: 'wx_123',
    text: '帮我记一下这家店',
    timestamp: 1787686983202,
    attachments: [{ mediaType: 'image/png' }],
  })
  assert.equal(envelope.channel, 'wechat')
  assert.ok(envelope.id.length > 0)
  assert.equal(envelope.attachments[0].mediaType, 'image/png')
})
