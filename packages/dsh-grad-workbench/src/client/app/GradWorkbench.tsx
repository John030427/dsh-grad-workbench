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
  { id: 'research', label: '🔬 Research', enabled: true },
  { id: 'communication', label: '💬 Communication', enabled: true },
  { id: 'life', label: '🍜 Life', enabled: true },
  { id: 'automation', label: '⚙️ Automation', enabled: true },
  { id: 'memory', label: '🧠 Memory', enabled: true },
  { id: 'connections', label: '🔗 Connections', enabled: true },
  { id: 'settings', label: '🔧 Settings', enabled: false },
]

const PLACEHOLDER: Partial<Record<PageId, { title: string; phase: number; desc: string }>> = {
  settings: { title: 'Settings', phase: 1, desc: 'Workbench preferences, data location, memory write policy.' },
}

interface RestaurantInfo {
  id: string
  name: string
  status: string
  address?: string
  cuisines?: string[]
  notes?: string
  sourceTexts?: string[]
}

function FoodSection(): ReactElement {
  const [items, setItems] = useState<RestaurantInfo[]>([])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    void get<{ restaurants: RestaurantInfo[] }>('/food/restaurants').then((d) => setItems(d.restaurants)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await post('/food/restaurants', { name: name.trim(), ...(note ? { note } : {}) })
      setName('')
      setNote('')
      load()
    } finally {
      setBusy(false)
    }
  }

  const act = async (id: string, action: 'confirm' | 'delete' | 'status', extra?: Record<string, unknown>) => {
    setBusy(true)
    try {
      await post(`/food/restaurants/${id}/${action}`, extra ?? {})
      load()
    } finally {
      setBusy(false)
    }
  }

  const unresolved = items.filter((r) => r.status === 'unresolved')
  const confirmed = items.filter((r) => r.status !== 'unresolved')

  return (
    <div>
      <div className="gwb-card">
        <h3>Save a restaurant</h3>
        <p className="gwb-muted">Captures stay <b>unresolved</b> until you confirm the place — ambiguous locations are never auto-pinned.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="gwb-input" style={{ flex: 1 }} placeholder="Restaurant name…" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="gwb-input" style={{ flex: 1 }} placeholder="Note (who recommended / why)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button type="button" className="gwb-btn primary" disabled={busy || !name.trim()} onClick={add}>Add</button>
        </div>
      </div>

      {unresolved.length > 0 ? (
        <div className="gwb-card">
          <h3>Unresolved queue ({unresolved.length}) — needs your confirmation</h3>
          {unresolved.map((r) => (
            <ConfirmRow key={r.id} r={r} busy={busy} onConfirm={act} onDelete={act} />
          ))}
        </div>
      ) : null}

      <div className="gwb-card">
        <h3>Confirmed pins ({confirmed.length})</h3>
        {confirmed.length === 0 ? (
          <p className="gwb-muted">Nothing pinned yet.</p>
        ) : (
          confirmed.map((r) => (
            <div key={r.id} className="gwb-row">
              <span className="gwb-pill">{r.status}</span>
              <span style={{ flex: 1 }}>{r.name}</span>
              {r.address ? <span className="gwb-muted">{r.address}</span> : null}
              <button type="button" className="gwb-btn" disabled={busy} onClick={() => act(r.id, 'status', { status: 'visited' })}>
                Mark visited
              </button>
              <button type="button" className="gwb-btn danger" disabled={busy} onClick={() => act(r.id, 'delete')}>Delete</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ConfirmRow({ r, busy, onConfirm, onDelete }: {
  r: RestaurantInfo
  busy: boolean
  onConfirm: (id: string, action: 'confirm' | 'delete', extra?: Record<string, unknown>) => void
  onDelete: (id: string, action: 'confirm' | 'delete') => void
}): ReactElement {
  const [address, setAddress] = useState('')
  return (
    <div className="gwb-row">
      <span className="gwb-pill gwb-warn">{r.status}</span>
      <span style={{ flex: 1 }}>{r.name}</span>
      <input
        className="gwb-input"
        style={{ width: 220 }}
        placeholder="Confirm address…"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <button type="button" className="gwb-btn primary" disabled={busy || !address.trim()} onClick={() => onConfirm(r.id, 'confirm', { address })}>
        Confirm pin
      </button>
      <button type="button" className="gwb-btn danger" disabled={busy} onClick={() => onDelete(r.id, 'delete')}>Delete</button>
    </div>
  )
}

interface LedgerEntryInfo {
  id: string
  category: string
  startAt: string
  durationMinutes?: number
  organization?: string
  activityType?: string
  note?: string
}

function LedgerSection(): ReactElement {
  const [entries, setEntries] = useState<LedgerEntryInfo[]>([])
  const [summary, setSummary] = useState<{ totalMinutes: number; count: number } | null>(null)
  const [org, setOrg] = useState('')
  const [hours, setHours] = useState('3')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    void get<{ entries: LedgerEntryInfo[]; summary: { totalMinutes: number; count: number } }>('/ledger?category=volunteer')
      .then((d) => {
        setEntries(d.entries)
        setSummary(d.summary)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    const h = Number(hours)
    if (!org.trim() || !Number.isFinite(h)) return
    setBusy(true)
    try {
      const start = new Date()
      await post('/ledger', {
        category: 'volunteer',
        startAt: start.toISOString(),
        durationMinutes: Math.round(h * 60),
        organization: org.trim(),
        activityType: 'volunteer',
        ...(note ? { note } : {}),
      })
      setNote('')
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="gwb-card">
        <h3>Volunteer hours</h3>
        {summary ? (
          <p>
            Total: <b>{Math.round((summary.totalMinutes / 60) * 10) / 10} h</b> across {summary.count} entries
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="gwb-input" style={{ flex: 1 }} placeholder="Organization / activity" value={org} onChange={(e) => setOrg(e.target.value)} />
          <input className="gwb-input" style={{ width: 90 }} value={hours} onChange={(e) => setHours(e.target.value)} />
          <span className="gwb-muted" style={{ alignSelf: 'center' }}>hours</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="gwb-input" style={{ flex: 1 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="gwb-btn primary" disabled={busy || !org.trim()} onClick={add}>Log hours</button>
          <a className="gwb-btn" href="/api/grad/ledger?category=volunteer&format=csv">Export CSV</a>
        </div>
      </div>

      <div className="gwb-card">
        <h3>Recent entries</h3>
        {entries.length === 0 ? <p className="gwb-muted">No entries yet.</p> : null}
        {entries.slice(0, 10).map((e) => (
          <div key={e.id} className="gwb-row">
            <span className="gwb-pill">{e.category}</span>
            <span style={{ flex: 1 }}>{e.organization ?? e.note ?? e.activityType}</span>
            <span className="gwb-muted">{new Date(e.startAt).toLocaleDateString()}</span>
            {e.durationMinutes !== undefined ? <span className="gwb-pill">{(e.durationMinutes / 60).toFixed(1)} h</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function LifePage(): ReactElement {
  const [tab, setTab] = useState<'food' | 'ledger'>('food')
  return (
    <div>
      <div className="gwb-card">
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`gwb-btn${tab === 'food' ? ' primary' : ''}`} onClick={() => setTab('food')}>Food Map</button>
          <button type="button" className={`gwb-btn${tab === 'ledger' ? ' primary' : ''}`} onClick={() => setTab('ledger')}>Ledger</button>
        </div>
      </div>
      {tab === 'food' ? <FoodSection /> : <LedgerSection />}
    </div>
  )
}

interface UnderstandingInfo {
  relationship: string
  scenario: string
  intent: string
  risk: string
  coreDemand: string
  keyPoints: string[]
  commitments: Array<{ what: string; due?: string }>
}

function CommunicationPage(): ReactElement {
  const [originalText, setOriginalText] = useState('')
  const [myUpdate, setMyUpdate] = useState('')
  const [understanding, setUnderstanding] = useState<UnderstandingInfo | null>(null)
  const [drafts, setDrafts] = useState<Array<{ tone: string; markdown: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = async () => {
    if (!originalText.trim()) return
    setBusy(true)
    setError(null)
    try {
      const d = await post<{ understanding: UnderstandingInfo }>('/communication/understand', { text: originalText })
      setUnderstanding(d.understanding)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const draft = async () => {
    if (!originalText.trim()) return
    setBusy(true)
    setError(null)
    try {
      const d = await post<{ drafts: Array<{ tone: string; markdown: string }> }>('/communication/draft', {
        originalText: originalText,
        ...(myUpdate.trim() ? { myUpdate: myUpdate } : {}),
      })
      setDrafts(d.drafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const copyDraft = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div>
      <div className="gwb-card">
        <h3>Advisor message assistant</h3>
        <p className="gwb-muted">理解 → 起草。草稿仅保存在本地；发送永远需要通过连接器的审批流程。</p>
        <textarea
          className="gwb-input"
          rows={4}
          placeholder="Paste the advisor/teacher message here…"
          value={originalText}
          onChange={(e) => setOriginalText(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button type="button" className="gwb-btn primary" disabled={busy || !originalText.trim()} onClick={analyze}>
            Understand
          </button>
        </div>
      </div>

      {understanding ? (
        <div className="gwb-card">
          <h3>Understanding</h3>
          <p>
            <span className="gwb-pill">{understanding.relationship}</span>{' '}
            <span className="gwb-pill">{understanding.scenario}</span>{' '}
            <span className="gwb-pill">{understanding.intent}</span>{' '}
            <span className={`gwb-pill ${understanding.risk === 'high' ? 'gwb-bad' : ''}`}>risk: {understanding.risk}</span>
          </p>
          <p>{understanding.coreDemand}</p>
          {understanding.commitments.length > 0 ? (
            <>
              <h3 style={{ marginTop: 10 }}>Commitments / deadlines detected</h3>
              {understanding.commitments.map((c, i) => (
                <p key={i}>
                  • {c.what} {c.due ? <span className="gwb-warn">(due: {c.due})</span> : null}
                </p>
              ))}
            </>
          ) : null}
          <textarea
            className="gwb-input"
            style={{ marginTop: 8 }}
            rows={2}
            placeholder="你实际完成的事项（草稿只引用你提供的事实，绝不编造进度）"
            value={myUpdate}
            onChange={(e) => setMyUpdate(e.target.value)}
          />
          <div style={{ marginTop: 8 }}>
            <button type="button" className="gwb-btn primary" disabled={busy} onClick={draft}>
              Draft replies
            </button>
          </div>
        </div>
      ) : null}

      {drafts.map((d) => (
        <div key={d.tone} className="gwb-card">
          <h3>
            Draft — {d.tone}{' '}
            <button type="button" className="gwb-btn" style={{ float: 'right' }} onClick={() => copyDraft(d.markdown)}>
              Copy
            </button>
          </h3>
          <pre className="gwb-mono" style={{ whiteSpace: 'pre-wrap' }}>{d.markdown}</pre>
        </div>
      ))}

      {error ? <div className="gwb-card"><p className="gwb-bad">{error}</p></div> : null}
    </div>
  )
}

interface ConnectorInfo {
  id: string
  label: string
  actions: string[]
  notes?: string
  healthy?: boolean
  reason?: string
}

function ConnectionsPage(): ReactElement {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([])

  useEffect(() => {
    void get<{ connectors: ConnectorInfo[] }>('/connectors').then((d) => setConnectors(d.connectors)).catch(() => {})
  }, [])

  return (
    <div>
      <div className="gwb-card">
        <h3>Connections</h3>
        <p className="gwb-muted">
          External systems are reachable only through connectors. Every publish/send/submit action requires explicit
          approval and is recorded with its approval id.
        </p>
      </div>
      {connectors.map((c) => (
        <div key={c.id} className="gwb-card">
          <h3>
            {c.label}{' '}
            {c.healthy ? <span className="gwb-pill gwb-ok">ready</span> : <span className="gwb-pill gwb-warn">needs setup</span>}
          </h3>
          {c.reason ? <p className="gwb-warn">{c.reason}</p> : null}
          {c.notes ? <p className="gwb-muted">{c.notes}</p> : null}
          <div>
            {c.actions.map((a) => (
              <span key={a} className="gwb-pill" style={{ marginRight: 6 }}>{a}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface CollectionPaper {
  id: string
  title: string
  authors: string[]
  year?: number
  venue?: string
  citationCount?: number
  evidenceLevel: string
}

function ResearchPage(): ReactElement {
  const [topic, setTopic] = useState('LLM agent memory')
  const [count, setCount] = useState(50)
  const [since, setSince] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [papers, setPapers] = useState<CollectionPaper[]>([])
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [complete, setComplete] = useState<boolean | null>(null)
  const [report, setReport] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setPapers([])
    setReport(null)
    setCollectionId(null)
    try {
      const data = await post<{ collectionId: string; papers: CollectionPaper[]; complete: boolean; note?: string }>(
        '/research/collections',
        { topic: topic.trim(), count, ...(since ? { since } : {}) },
      )
      setPapers(data.papers ?? [])
      setCollectionId(data.collectionId)
      setComplete(data.complete)
      setNote(data.note ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const synthesizeNow = async () => {
    if (!collectionId) return
    setBusy(true)
    try {
      const r = await post<{ artifactId: string }>(`/research/collections/${collectionId}/synthesize`, {})
      const art = await get<{ content: string }>(`/artifacts/${r.artifactId}`)
      setReport(art.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="gwb-card">
        <h3>Latest Literature Radar</h3>
        <p className="gwb-muted">OpenAlex discovery → S2 enrichment → DOI/OA/S2 dedup → relevance+recency rank. Evidence-tagged deterministic report.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="gwb-input" style={{ flex: 2, minWidth: 200 }} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
          <input className="gwb-input" style={{ flex: 0, width: 80 }} type="number" min={5} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          <input className="gwb-input" style={{ flex: 0, width: 110 }} value={since} onChange={(e) => setSince(e.target.value)} placeholder="since (year)" />
          <button type="button" className="gwb-btn primary" disabled={busy || !topic.trim()} onClick={run}>
            {busy ? 'Collecting…' : 'Collect'}
          </button>
        </div>
        {error ? <p className="gwb-bad">{error}</p> : null}
        {note ? <p className="gwb-warn">{note}</p> : null}
        {complete === false && papers.length > 0 ? (
          <p className="gwb-warn">Partial corpus — provider limits. Results shown honestly, nothing fabricated.</p>
        ) : null}
      </div>

      {papers.length > 0 ? (
        <div className="gwb-card">
          <h3>Papers ({papers.length})</h3>
          {papers.map((p) => (
            <div key={p.id} className="gwb-row">
              <span className="gwb-pill">{p.evidenceLevel === 'metadata' ? '[M]' : '[A]'}</span>
              <span style={{ flex: 1 }}>{p.title}</span>
              <span className="gwb-muted">{p.year ?? ''}</span>
              <span className="gwb-muted">{p.citationCount !== undefined ? `${p.citationCount} cites` : ''}</span>
            </div>
          ))}
          {collectionId ? (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="gwb-btn primary" disabled={busy} onClick={synthesizeNow}>
                Generate cited report
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {report ? (
        <div className="gwb-card">
          <h3>Report preview</h3>
          <pre className="gwb-mono" style={{ whiteSpace: 'pre-wrap' }}>{report.slice(0, 4000)}</pre>
        </div>
      ) : null}
    </div>
  )
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
  const [skills, setSkills] = useState<Array<{ id: string; title: string; requiredInputs: string[]; outputs: string[]; externalSideEffect: boolean }>>([])
  const [recipes, setRecipes] = useState<Array<{ recipeId: string; title: string; steps: string }>>([])
  const [stepIds, setStepIds] = useState<string[]>([])

  useEffect(() => {
    void get<{ skills: typeof skills; recipes: typeof recipes }>('/skills')
      .then((d) => {
        setSkills(d.skills)
        setRecipes(d.recipes)
      })
      .catch(() => {})
  }, [])

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

      <div className="gwb-card">
        <h3>Skill Studio — atomic skills</h3>
        <p className="gwb-muted">
          {stepIds.length > 0 ? (
            <>Selected chain: {stepIds.join(' → ')} (compose via grad_skill_compose_recipe)</>
          ) : (
            'Pick skills to see a chain preview; compose via the grad_skill_compose_recipe tool.'
          )}
        </p>
        {skills.map((s) => (
          <div key={s.id} className="gwb-row">
            <span className="gwb-pill">{s.externalSideEffect ? 'side-effect' : 'local'}</span>
            <span style={{ flex: 1 }}>{s.title}</span>
            <span className="gwb-muted gwb-mono">
              in: [{s.requiredInputs.join(',')}] out: [{s.outputs.join(',')}]
            </span>
            <button
              type="button"
              className="gwb-btn"
              onClick={() => setStepIds((prev) => [...prev, s.id])}
            >
              + chain
            </button>
          </div>
        ))}
        {stepIds.length > 0 ? (
          <button type="button" className="gwb-btn" onClick={() => setStepIds([])}>Clear chain</button>
        ) : null}
        {recipes.length > 0 ? (
          <>
            <h3 style={{ marginTop: 10 }}>Composed recipes</h3>
            {recipes.map((r) => (
              <div key={r.recipeId} className="gwb-row">
                <span className="gwb-mono">{r.recipeId}</span>
                <span>{r.title}</span>
                <span className="gwb-muted" style={{ flex: 1 }}>{r.steps}</span>
              </div>
            ))}
          </>
        ) : null}
      </div>

      <PlaceholderPage page={{ title: 'Form Assistant UI', phase: 8, desc: 'Inspect forms and propose values with sources via the grad_form_* tools; fill/submit run behind two separate approvals.' }} />
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
          ) : page === 'research' ? (
            <ResearchPage />
          ) : page === 'automation' ? (
            <AutomationPage runs={runs} />
          ) : page === 'memory' ? (
            <MemoryPage />
          ) : page === 'connections' ? (
            <ConnectionsPage />
          ) : page === 'communication' ? (
            <CommunicationPage />
          ) : page === 'life' ? (
            <LifePage />
          ) : placeholder ? (
            <PlaceholderPage page={placeholder} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
