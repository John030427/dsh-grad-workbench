/**
 * Graduate OS workbench client — one surface inside the native DSH session view.
 * Client is a projection only: all canonical state lives in the Host.
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

export const API = '/api/grad'

export interface HealthInfo {
  ok: boolean
  plugin: string
  version: string
  dataDir?: string
  migrations?: Array<{ version: number; name: string }>
  startedAt?: string
}

async function fetchHealth(): Promise<HealthInfo | null> {
  try {
    const res = await fetch(`${API}/health`)
    if (!res.ok) return null
    return (await res.json()) as HealthInfo
  } catch {
    return null
  }
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
.gwb-content { flex:1 1 auto; overflow-y:auto; padding:16px 20px; min-width:0; }
.gwb-card { border:1px solid rgba(128,128,128,.22); border-radius:12px; padding:14px 16px; margin-bottom:12px; background:rgba(128,128,128,.05); }
.gwb-card h3 { margin:0 0 6px 0; font-size:13px; }
.gwb-card p { margin:4px 0; opacity:.85; }
.gwb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
.gwb-action { text-align:left; border:1px solid rgba(128,128,128,.25); background:transparent; color:inherit; border-radius:10px; padding:10px 12px; cursor:pointer; }
.gwb-action:hover { border-color:rgba(99,140,255,.6); }
.gwb-pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; border:1px solid rgba(128,128,128,.3); }
.gwb-ok { color:#4ade80; }
.gwb-bad { color:#f87171; }
.gwb-muted { opacity:.55; }
`

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

// ── pages ───────────────────────────────────────────────────────────────────

type PageId =
  | 'home'
  | 'research'
  | 'communication'
  | 'life'
  | 'automation'
  | 'memory'
  | 'connections'
  | 'settings'

const NAV: Array<{ id: PageId; label: string }> = [
  { id: 'home', label: '🏠 Home' },
  { id: 'research', label: '🔬 Research' },
  { id: 'communication', label: '💬 Communication' },
  { id: 'life', label: '🍜 Life' },
  { id: 'automation', label: '⚙️ Automation' },
  { id: 'memory', label: '🧠 Memory' },
  { id: 'connections', label: '🔗 Connections' },
  { id: 'settings', label: '🔧 Settings' },
]

const PLACEHOLDER: Partial<Record<PageId, { title: string; phase: number; desc: string }>> = {
  research: { title: 'Research', phase: 3, desc: 'Latest-50 literature radar → cited synthesis → Feishu publish → audio brief.' },
  communication: { title: 'Communication', phase: 5, desc: 'Advisor message understanding and reply drafting. Drafts only until approved.' },
  life: { title: 'Life', phase: 6, desc: 'Food Map, fitness log, volunteer/activity ledger.' },
  automation: { title: 'Automation', phase: 8, desc: 'Form Assistant, Skill Studio and reusable workflow recipes.' },
  memory: { title: 'Memory Center', phase: 2, desc: 'Scoped, inspectable, source-attributed local memory.' },
  connections: { title: 'Connections', phase: 4, desc: 'Feishu/Lark first; WeChat behind adapter + feature flag.' },
  settings: { title: 'Settings', phase: 1, desc: 'Workbench preferences, data location, memory write policy.' },
}

function HomePage({ health }: { health: HealthInfo | null }) {
  return (
    <div>
      <div className="gwb-card">
        <h3>Graduate OS / 硕博工作台</h3>
        <p className="gwb-muted">
          Task-first workbench: input → task router → Skill / Workflow → tools + memory + model policy →
          artifact → approval when side effects exist → connector.
        </p>
        {health ? (
          <p>
            <span className="gwb-pill gwb-ok">host online</span>{' '}
            <span className="gwb-pill">v{health.version}</span>{' '}
            <span className="gwb-pill">migrations: {health.migrations?.length ?? 0}</span>
          </p>
        ) : (
          <p><span className="gwb-pill gwb-bad">host unreachable</span></p>
        )}
      </div>
      <div className="gwb-card">
        <h3>Quick actions</h3>
        <div className="gwb-grid">
          {[
            ['📄 Latest 50 papers', 'research'],
            ['💬 Understand teacher msg', 'communication'],
            ['🍜 Save restaurant', 'life'],
            ['📝 Fill form', 'automation'],
            ['✅ Log volunteer hours', 'life'],
            ['🏋️ Log workout', 'life'],
          ].map(([label]) => (
            <button key={label} type="button" className="gwb-action" disabled title="Arrives with its vertical slice">
              {label}
            </button>
          ))}
        </div>
      </div>
      {health?.dataDir ? (
        <div className="gwb-card">
          <h3>Data</h3>
          <p className="gwb-muted" style={{ wordBreak: 'break-all' }}>local-first root: {health.dataDir}</p>
        </div>
      ) : null}
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

  useEffect(() => {
    ensureStyles()
    let alive = true
    fetchHealth().then((info) => {
      if (alive) setHealth(info)
    })
    return () => {
      alive = false
    }
  }, [])

  const placeholder = PLACEHOLDER[page]

  return (
    <div className="gwb-root">
      <div className="gwb-header">
        <span className="gwb-title">🎓 硕博工作台 · Graduate OS</span>
        {health ? <span className="gwb-sub">v{health.version}</span> : <span className="gwb-sub gwb-bad">offline</span>}
      </div>
      <div className="gwb-body">
        <nav className="gwb-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`gwb-nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <main className="gwb-content">
          {page === 'home' ? (
            <HomePage health={health} />
          ) : placeholder ? (
            <PlaceholderPage page={placeholder} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
