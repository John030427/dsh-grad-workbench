/**
 * Shared typed contracts between Host and Client.
 * Serializable shapes only — these cross the HTTP boundary and appear in
 * tool outputs. Keep enum values stable; extend, never mutate meaning.
 */

// ── provenance ──────────────────────────────────────────────────────────────

export type SourceRef = {
  id: string
  kind: 'url' | 'file' | 'artifact' | 'message' | 'provider-record' | 'user'
  ref: string
  title?: string
  createdAt: string
}

export type ArtifactKind =
  | 'research-report'
  | 'paper-table'
  | 'audio-script'
  | 'audio-file'
  | 'communication-draft'
  | 'form-recipe'
  | 'export-csv'
  | 'import'
  | 'generic'

export type ArtifactRef = {
  id: string
  kind: ArtifactKind
  mediaType: string
  path: string
  sha256: string
  sizeBytes: number
  createdAt: string
  workflowRunId?: string
  sourceRefs: SourceRef[]
}

// ── universal inbox ─────────────────────────────────────────────────────────

export type CaptureSource = 'dsh' | 'feishu' | 'wechat' | 'file' | 'browser' | 'share'
export type CaptureStatus = 'new' | 'routed' | 'archived'

export type CaptureItem = {
  id: string
  createdAt: string
  source: CaptureSource
  sourceRef?: string
  mimeType?: string
  text?: string
  attachmentRefs?: string[]
  inferredIntent?: string
  routeConfidence?: number
  status: CaptureStatus
}

export type InboundEnvelope = {
  id: string
  channel: 'dsh' | 'feishu' | 'wechat' | 'other'
  accountId?: string
  conversationId?: string
  senderId?: string
  timestamp: string
  text?: string
  attachments: AttachmentRef[]
  quotedMessage?: { channel: string; messageId: string }
}

export type AttachmentRef = {
  id: string
  mediaType?: string
  path?: string
}

// ── memory ──────────────────────────────────────────────────────────────────

export type MemoryScopeType = 'global' | 'project' | 'skill' | 'channel'
export type MemoryKind = 'fact' | 'preference' | 'decision' | 'lesson' | 'entity' | 'summary'
export type MemorySourceType = 'user' | 'workflow' | 'artifact' | 'import'
export type Sensitivity = 'normal' | 'private' | 'restricted'

export type MemoryItem = {
  id: string
  scopeType: MemoryScopeType
  scopeId?: string
  kind: MemoryKind
  content: string
  sourceType: MemorySourceType
  sourceRef?: string
  confidence: number
  createdAt: string
  validFrom?: string
  validTo?: string
  supersedesId?: string
  sensitivity: Sensitivity
  userConfirmed: boolean
  pinned?: boolean
  outdated?: boolean
}

export type MemoryUsage = {
  id: string
  memoryId: string
  workflowRunId: string
  stepId?: string
  usedAt: string
  why: string
}

// ── workflow ────────────────────────────────────────────────────────────────

export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'failed'
  | 'completed'

export type ModelDecision = {
  stepId?: string
  purpose: string
  model: string
  provider: string
  reason: string
  escalatedFrom?: string
  tokensIn?: number
  tokensOut?: number
  latencyMs?: number
}

export type WorkflowRun = {
  id: string
  workflowId: string
  workflowVersion: string
  startedAt: string
  finishedAt?: string
  status: WorkflowRunStatus
  inputSnapshot: unknown
  outputRefs: string[]
  modelDecisions: ModelDecision[]
  sourceRefs: SourceRef[]
  approvalRefs: string[]
  sessionId?: string
  error?: string
}

export type WorkflowStep = {
  id: string
  runId: string
  skillId: string
  skillVersion: string
  name: string
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'skipped'
  input: unknown
  output: unknown
  toolCalls: Array<{ tool: string; at: string; ok: boolean }>
  startedAt?: string
  finishedAt?: string
  modelChosen?: string
  failure?: string
  retryOf?: string
}

// ── approvals ───────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed'

export type ApprovalRequest = {
  id: string
  actionType: string
  summary: string
  payload: unknown
  payloadHash: string
  destination?: string
  previewArtifactId?: string
  workflowRunId?: string
  stepId?: string
  status: ApprovalStatus
  createdAt: string
  expiresAt?: string
  resolvedAt?: string
  consumedAt?: string
  resolvedBy?: 'user' | 'system'
}

// ── research ────────────────────────────────────────────────────────────────

export type EvidenceLevel = 'metadata' | 'abstract' | 'fulltext'

export type Paper = {
  id: string
  title: string
  authors: string[]
  year?: number
  date?: string
  venue?: string
  doi?: string
  openAlexId?: string
  s2Id?: string
  citationCount?: number
  openAccess?: boolean
  abstractAvailable: boolean
  relevanceScore?: number
  theme?: string
  evidenceLevel: EvidenceLevel
  sourceRefs: SourceRef[]
}

export type PaperCollection = {
  id: string
  topic: string
  querySpec: Record<string, unknown>
  requestedCount: number
  papers: Paper[]
  createdAt: string
  complete: boolean
  notes?: string
}

// ── food ────────────────────────────────────────────────────────────────────

export type Restaurant = {
  id: string
  name: string
  aliases: string[]
  address?: string
  lat?: number
  lng?: number
  city?: string
  sourceRefs: string[]
  sourceImages: string[]
  tags: string[]
  cuisines: string[]
  priceBand?: string
  status: 'want_to_try' | 'visited' | 'favorite' | 'avoid' | 'unresolved'
  ratingByUser?: number
  notes?: string
  firstSavedAt: string
  lastVisitedAt?: string
}

// ── ledger ──────────────────────────────────────────────────────────────────

export type LedgerEntry = {
  id: string
  category: 'volunteer' | 'fitness' | 'research' | 'reading' | 'custom'
  startAt: string
  endAt?: string
  durationMinutes?: number
  projectId?: string
  organization?: string
  activityType?: string
  note?: string
  evidenceRefs?: string[]
  source: 'manual' | 'channel' | 'import' | 'tracker'
  verification: 'self' | 'evidence_attached' | 'verified'
}
