/**
 * Graduate OS workbench client — one surface inside the native DSH session view.
 * Client is a projection only: all canonical state lives in the Host.
 * Every external action shown here routes through the Host approval service.
 */

import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'

export const API = '/api/grad'

// ── host-facing types (mirror shared/contracts) ─────────────────────────────

export interface HealthInfo {
  ok: boolean
  plugin: string
  version: string
  dataDir?: string
  migrations?: Array<{ version: number; name: string }>
  workflows?: Array<{ id: string; title: string; steps: number }>
}

export interface RunInfo {
  id: string
  workflowId: string
  status: 'queued' | 'running' | 'waiting_approval' | 'failed' | 'completed'
  startedAt: string
  finishedAt?: string
  error?: string
}

export interface ApprovalInfo {
  id: string
  actionType: string
  summary: string
  destination?: string
  workflowRunId?: string
  status: string
  createdAt: string
  payload?: unknown
}

export interface CaptureInfo {
  id: string
  createdAt: string
  source: string
  text?: string
  inferredIntent?: string
  routeConfidence?: number
  status: string
}

export interface MemoryInfo {
  id: string
  scopeType: string
  kind: string
  content: string
  sourceType: string
  confidence: number
  createdAt: string
  sensitivity: string
  userConfirmed: boolean
  pinned?: boolean
  outdated?: boolean
  why?: string
  ageDays?: number
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return (await res.json()) as T
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as T & { ok?: boolean; error?: string }
  if (!res.ok || data.ok === false) throw new Error(data.error ?? `${path}: ${res.status}`)
  return data
}

// ── styles ──────────────────────────────────────────────────────────────────

const STYLE_ID = 'dsh-grad-workbench-styles'

const CSS = `
.gwb-root { display:flex; flex-direction:column; height:100%; min-height:0; font-size:13px; color:inherit; }
.gwb-header { display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid rgba(128,128,128,.22); flex:none; }
.gwb-title { font-weight:700; font-size:14px; }
.gwb-sub { opacity:.65; font-size:12px; }
.gwb-body { display:flex; flex:1 1 auto; min-height:0; }
.gwb-nav { width:168px; flex:none; border-right:1px solid rgba(128,128,128,.18); padding:8px 6px; display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
.gwb-nav-item { text-align:left; border:0; background:transparent; color:inherit; cursor:pointer; padding:7px 10px; border-radius:8px; font-size:13px; }
.gwb-nav-item:hover { background:rgba(128,128,128,.15); }
.gwb-nav-item.active { background:rgba(99,140,255,.22); font-weight:600; }
.gwb-nav-item:disabled { opacity:.45; cursor:default; }
.gwb-content { flex:1 1 auto; overflow-y:auto; padding:16px 20px; min-width:0; }
.gwb-card { border:1px solid rgba(128,128,128,.22); border-radius:12px; padding:14px 16px; margin-bottom:12px; background:rgba(128,128,128,.05); }
.gwb-card h3 { margin:0 0 6px 0; font-size:13px; }
.gwb-card p { margin:4px 0; opacity:.85; }
.gwb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
.gwb-action { text-align:left; border:1px solid rgba(128,128,128,.25); background:transparent; color:inherit; border-radius:10px; padding:10px 12px; cursor:pointer; }
.gwb-action:hover:not(:disabled) { border-color:rgba(99,140,255,.6); }
.gwb-action:disabled { opacity:.45; cursor:default; }
.gwb-pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; border:1px solid rgba(128,128,128,.3); }
.gwb-ok { color:#4ade80; }
.gwb-bad { color:#f87171; }
.gwb-warn { color:#fbbf24; }
.gwb-muted { opacity:.55; }
.gwb-row { display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px dashed rgba(128,128,128,.15); flex-wrap:wrap; }
.gwb-row:last-child { border-bottom:0; }
.gwb-btn { border:1px solid rgba(128,128,128,.35); background:transparent; color:inherit; border-radius:8px; padding:4px 12px; cursor:pointer; font-size:12px; }
.gwb-btn.primary { border-color:#4ade80; color:#4ade80; }
.gwb-btn.danger { border-color:#f87171; color:#f87171; }
.gwb-btn:hover { filter:brightness(1.25); }
.gwb-input { width:100%; box-sizing:border-box; background:transparent; border:1px solid rgba(128,128,128,.3); color:inherit; border-radius:8px; padding:8px 10px; font-size:13px; resize:vertical; }
.gwb-mono { font-family:ui-monospace,Consolas,monospace; font-size:11px; word-break:break-all; }
`

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'completed' ? 'gwb-ok'
    : status === 'failed' ? 'gwb-bad'
    : status === 'waiting_approval' ? 'gwb-warn'
    : ''
  return <span className={`gwb-pill ${cls}`}>{status}</span>
}

// ── pages ───────────────────────────────────────────────────────────────────

type PageId = 'home' | 'research' | 'communication' | 'life' | 'automation' | 'memory' | 'connections' | 'settings'

const NAV: Array<{ id: PageId; label: string; enabled: boolean }> = [
  { id: 'home', label: '🏠 Home', enabled: true },
  { id: 'research', label: '🔬 Research', enabled: false },
  { id: 'communication', label: '💬 Communication', enabled: false },
  { id: 'life', label: '🍜 Life', enabled: false },
  { id: 'automation', label: '⚙️ Automation', enabled: true },
  { id: 'memory', label: '🧠 Memory', enabled: true },
  { id: 'connections', label: '🔗 Connections', enabled: false },
  { id: 'settings', label: '🔧 Settings', enabled: false },
]

const PLACEHOLDER: Partial<Record<PageId, { title: string; phase: number; desc: string }>> = {
  research: { title: 'Research', phase: 3, desc: 'Latest-50 literature radar → cited synthesis → Feishu publish → audio brief.' },
  communication: { title: 'Communication', phase: 5, desc: 'Advisor message understanding and reply drafting. Drafts only until approved.' },
  life: { title: 'Life', phase: 6, desc: 'Food Map, fitness log, volunteer/activity ledger.' },
  connections: { title: 'Connections', phase: 4, desc: 'Feishu/Lark first; WeChat behind adapter + feature flag.' },
  settings: { title: 'Settings', phase: 1, desc: 'Workbench preferences, data location, memory write policy.' },
}

function MemoryPage(): ReactElement {
  const [items, setItems] = useState<MemoryInfo[]>([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    const path = query.trim() ? `/memory?q=${encodeURIComponent(query.trim())}` : '/memory'
    void get<{ items?: MemoryInfo[]; results?: MemoryInfo[] }>(path).then((d) => {
      setItems(d.items ?? d.results ?? [])
    }).catch(() => {})
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!draft.trim()) return
    setBusy(true)
    try {
      await post('/memory', { content: draft.trim() })
      setDraft('')
      load()
    } finally {
      setBusy(false)
    }
  }

  const act = async (id: string, action: 'confirm' | 'pin' | 'delete') => {
    setBusy(true)
    try {
      await post(`/memory/${id}/${action}`, {})
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="gwb-card">
        <h3>Memory Center</h3>
        <p className="gwb-muted">
          Local-first, scoped, source-attributed. Candidates (unconfirmed proposals) need your confirmation before they
          become first-class.
        </p>
        <input
          className="gwb-input"
          placeholder="Search memory…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            className="gwb-input"
            style={{ flex: 1 }}
            placeholder="Remember something new…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="button" className="gwb-btn primary" disabled={busy || !draft.trim()} onClick={add}>
            Add
          </button>
        </div>
      </div>

      <div className="gwb-card">
        {items.length === 0 ? (
          <p className="gwb-muted">{query ? `No matches for "${query}".` : 'Memory is empty.'}</p>
        ) : (
          items.map((m) => (
            <div key={m.id} className="gwb-row">
              <span className="gwb-pill">{m.kind}</span>
              <span className="gwb-pill gwb-muted">{m.scopeType}</span>
              {!m.userConfirmed ? <span className="gwb-pill gwb-warn">candidate</span> : null}
              {m.pinned ? <span className="gwb-pill">📌</span> : null}
              {m.outdated ? <span className="gwb-pill gwb-muted">outdated</span> : null}
              <span style={{ flex: 1 }}>{m.content}</span>
              <button type="button" className="gwb-btn" disabled={busy} onClick={() => act(m.id, 'pin')}>
                {m.pinned ? 'Unpin' : 'Pin'}
              </button>
              {!m.userConfirmed ? (
                <button type="button" className="gwb-btn primary" disabled={busy} onClick={() => act(m.id, 'confirm')}>
                  Confirm
                </button>
              ) : null}
              <button type="button" className="gwb-btn danger" disabled={busy} onClick={() => act(m.id, 'delete')}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function PendingApprovalsCard({ approvals, onChanged }: { approvals: ApprovalInfo[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  if (approvals.length === 0) {
    return (
      <div className="gwb-card">
        <h3>Pending approvals</h3>
        <p className="gwb-muted">No external actions waiting. Side effects always require explicit approval here.</p>
      </div>
    )
  }
  const resolve = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(true)
    try {
      await post(`/approvals/${id}/resolve`, { decision })
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="gwb-card">
      <h3>Pending approvals ({approvals.length})</h3>
      {approvals.map((a) => (
        <div key={a.id} className="gwb-row">
          <StatusPill status={a.actionType} />
          <span style={{ flex: 1 }}>{a.summary}</span>
          {a.destination ? <span className="gwb-muted">→ {a.destination}</span> : null}
          {a.workflowRunId ? <span className="gwb-mono gwb-muted">{a.workflowRunId.slice(0, 8)}</span> : null}
          <button type="button" className="gwb-btn danger" disabled={busy} onClick={() => resolve(a.id, 'rejected')}>
            Reject
          </button>
          <button type="button" className="gwb-btn primary" disabled={busy} onClick={() => resolve(a.id, 'approved')}>
            Approve once
          </button>
        </div>
      ))}
    </div>
  )
}

function HomePage({
  health,
  runs,
  approvals,
  captures,
  onChanged,
}: {
  health: HealthInfo | null
  runs: RunInfo[]
  approvals: ApprovalInfo[]
  captures: CaptureInfo[]
  onChanged: () => void
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const capture = async () => {
    if (!draft.trim()) return
    setBusy(true)
    try {
      await post('/captures', { text: draft.trim() })
      setDraft('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const runEchoDemo = async () => {
    setBusy(true)
    try {
      await post('/workflows/echo-demo/run', { input: { message: `Home quick action ${new Date().toLocaleTimeString()}` } })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="gwb-card">
        <h3>Universal capture</h3>
        <textarea
          className="gwb-input"
          rows={2}
          placeholder="Paste a sentence, a teacher message, a paper topic…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button type="button" className="gwb-btn primary" disabled={busy || !draft.trim()} onClick={capture}>
            Capture → route
          </button>
        </div>
      </div>

      <PendingApprovalsCard approvals={approvals} onChanged={onChanged} />

      <div className="gwb-card">
        <h3>Recent workflow runs</h3>
        {runs.length === 0 ? (
          <p className="gwb-muted">
            No runs yet.{' '}
            <button type="button" className="gwb-btn" disabled={busy} onClick={runEchoDemo}>
              Run echo-demo
            </button>{' '}
            to see the approval flow.
          </p>
        ) : (
          runs.slice(0, 8).map((r) => (
            <div key={r.id} className="gwb-row">
              <StatusPill status={r.status} />
              <span>{r.workflowId}</span>
              <span className="gwb-muted">{new Date(r.startedAt).toLocaleString()}</span>
              <span className="gwb-mono gwb-muted" style={{ marginLeft: 'auto' }}>
                {r.id.slice(0, 8)}
              </span>
              {r.error ? <span className="gwb-bad">{r.error}</span> : null}
            </div>
          ))
        )}
      </div>

      <div className="gwb-card">
        <h3>Latest captures</h3>
        {captures.length === 0 ? (
          <p className="gwb-muted">Nothing captured yet.</p>
        ) : (
          captures.slice(0, 6).map((c) => (
            <div key={c.id} className="gwb-row">
              <StatusPill status={c.status} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</span>
              {c.inferredIntent ? <span className="gwb-pill">{c.inferredIntent}</span> : null}
            </div>
          ))
        )}
      </div>

      {health?.dataDir ? (
        <div className="gwb-card">
          <h3>Data</h3>
          <p className="gwb-muted gwb-mono">local-first root: {health.dataDir}</p>
        </div>
      ) : null}
    </div>
  )
}

function AutomationPage({ runs }: { runs: RunInfo[] }) {
  return (
    <div>
      <div className="gwb-card">
        <h3>Run history</h3>
        {runs.length === 0 ? (
          <p className="gwb-muted">No runs recorded yet.</p>
        ) : (
          runs.map((r) => (
            <div key={r.id} className="gwb-row">
              <StatusPill status={r.status} />
              <span className="gwb-mono">{r.id.slice(0, 8)}</span>
              <span>{r.workflowId}</span>
              <span className="gwb-muted">{new Date(r.startedAt).toLocaleString()}</span>
              {r.error ? <span className="gwb-bad">{r.error}</span> : null}
            </div>
          ))
        )}
      </div>
      <PlaceholderPage page={{ title: 'Skill Studio', phase: 9, desc: 'Compose skills into typed recipes with validation and fixtures.' }} />
      <PlaceholderPage page={{ title: 'Form Assistant', phase: 8, desc: 'Inspect forms, propose values with sources, fill and submit behind two separate approvals.' }} />
    </div>
  )
}

function PlaceholderPage({ page }: { page: NonNullable<(typeof PLACEHOLDER)[PageId]> }) {
  return (
    <div className="gwb-card">
      <h3>{page.title}</h3>
      <p>{page.desc}</p>
      <p className="gwb-muted">Planned for phase {page.phase} of docs/DSH_DEVELOPMENT_PLAN.md.</p>
    </div>
  )
}

// ── shell ───────────────────────────────────────────────────────────────────

export function GradWorkbench(): ReactElement {
  const [page, setPage] = useState<PageId>('home')
  const [health, setHealth] = useState<HealthInfo | null>(null)
  const [runs, setRuns] = useState<RunInfo[]>([])
  const [approvals, setApprovals] = useState<ApprovalInfo[]>([])
  const [captures, setCaptures] = useState<CaptureInfo[]>([])

  const refresh = useCallback(() => {
    void get<{ ok: boolean } & HealthInfo>('/health').then(setHealth).catch(() => setHealth(null))
    void get<{ runs: RunInfo[] }>('/runs').then((d) => setRuns(d.runs)).catch(() => {})
    void get<{ approvals: ApprovalInfo[] }>('/approvals?status=pending').then((d) => setApprovals(d.approvals)).catch(() => {})
    void get<{ captures: CaptureInfo[] }>('/captures').then((d) => setCaptures(d.captures)).catch(() => {})
  }, [])

  useEffect(() => {
    ensureStyles()
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [refresh])

  const placeholder = PLACEHOLDER[page]

  return (
    <div className="gwb-root">
      <div className="gwb-header">
        <span className="gwb-title">🎓 硕博工作台 · Graduate OS</span>
        {health ? <span className="gwb-sub">v{health.version}</span> : <span className="gwb-sub gwb-bad">host offline</span>}
        {approvals.length > 0 ? <span className="gwb-pill gwb-warn">{approvals.length} approval(s) waiting</span> : null}
      </div>
      <div className="gwb-body">
        <nav className="gwb-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.enabled}
              title={item.enabled ? undefined : 'Arrives with its vertical slice'}
              className={`gwb-nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <main className="gwb-content">
          {page === 'home' ? (
            <HomePage health={health} runs={runs} approvals={approvals} captures={captures} onChanged={refresh} />
          ) : page === 'automation' ? (
            <AutomationPage runs={runs} />
          ) : page === 'memory' ? (
            <MemoryPage />
          ) : placeholder ? (
            <PlaceholderPage page={placeholder} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
