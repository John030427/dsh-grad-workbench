/**
 * WeChat channel adapter — architectural seam only (PRD §9.3, P1 beta).
 *
 * Feature-flagged OFF by default: `health()` reports disabled unless a bridge
 * URL is explicitly configured (GRAD_WECHAT_BRIDGE_URL). Inbound envelopes are
 * normalized to the shared shape; outbound sends always require an approval and
 * a working bridge. No hook-based or account-risky mechanism is used.
 */

import type { InboundEnvelope } from '../../shared/contracts.ts'

export function normalizeInboundEnvelope(raw: {
  channel?: string
  accountId?: string
  conversationId?: string
  senderId?: string
  timestamp?: number | string
  text?: string
  attachments?: Array<{ id?: string; mediaType?: string; path?: string }>
}): InboundEnvelope {
  const ts = typeof raw.timestamp === 'number' ? new Date(raw.timestamp).toISOString() : String(raw.timestamp ?? new Date().toISOString())
  return {
    id: crypto.randomUUID(),
    channel: 'wechat',
    ...(raw.accountId ? { accountId: raw.accountId } : {}),
    ...(raw.conversationId ? { conversationId: raw.conversationId } : {}),
    ...(raw.senderId ? { senderId: raw.senderId } : {}),
    timestamp: ts,
    ...(raw.text ? { text: raw.text } : {}),
    attachments: (raw.attachments ?? []).map((a) => ({ id: a.id ?? crypto.randomUUID(), ...(a.mediaType ? { mediaType: a.mediaType } : {}), ...(a.path ? { path: a.path } : {}) })),
  }
}

export interface WeChatBridgeConfig {
  enabled: boolean
  bridgeUrl?: string
}

export function loadBridgeConfig(env: NodeJS.ProcessEnv = process.env): WeChatBridgeConfig {
  const url = env.GRAD_WECHAT_BRIDGE_URL
  return url && url.startsWith('http') ? { enabled: true, bridgeUrl: url } : { enabled: false }
}
