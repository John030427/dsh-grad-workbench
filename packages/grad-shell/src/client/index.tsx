/**
 * Graduate OS Shell client — the SINGLE root layout owner for the dedicated
 * `grad` profile.
 *
 * Contract (see docs/COMPATIBILITY.md):
 * - suite patch disables `ui-layout`; this shell registers slot `root`
 *   (single seat), declaring the conversation / details / shell.overlay /
 *   grad.workbench children inside its own frame.
 * - Sets `window.__GRAD_SHELL_HOST__ = true` at module evaluation so the
 *   domain client's apply() runs its compat gate (skips legacy
 *   conversation.view registrations, avoiding a duplicate 硕博工作台 tab).
 * - Frame: single product sidebar (196–232px) · dominant workbench · narrow
 *   native Agent column (collapses to drawer + FAB ≤1180px). Theme-adaptive.
 *
 * NOTE: this package's client is NOT typechecked by the repo gate (esbuild
 * build only). Treat it as presentation-only, mirroring the math shell.
 */

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

declare global {
  interface Window {
    __GRAD_SHELL_HOST__?: boolean
  }
}

if (typeof window !== 'undefined') {
  window.__GRAD_SHELL_HOST__ = true
  document.documentElement.dataset.gradShellHost = '1'
}

const API = '/api/grad'
const NAV_KEY = 'grad-shell.section'

// ── nav model ───────────────────────────────────────────────────────────────

type SectionId = 'dashboard' | 'research' | 'communication' | 'life' | 'automation' | 'memory' | 'connections'

const NAV: Array<{ group: string; items: Array<{ id: SectionId; label: string; icon: string }> }> = [
  { group: '概览', items: [{ id: 'dashboard', label: 'Dashboard', icon: '🏠' }] },
  { group: '研究', items: [{ id: 'research', label: '文献雷达', icon: '🔬' }] },
  { group: '沟通', items: [{ id: 'communication', label: '导师沟通', icon: '💬' }] },
  { group: '生活', items: [{ id: 'life', label: '美食 / 台账', icon: '🍜' }] },
  { group: '自动化', items: [{ id: 'automation', label: '工作流 / 技能', icon: '⚙️' }] },
  { group: '基础', items: [{ id: 'memory', label: '记忆中心', icon: '🧠' }, { id: 'connections', label: '连接', icon: '🔗' }] },
]

const ALL_ITEMS = NAV.flatMap((g) => g.items)

const SECTION_META: Record<SectionId, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: '今天最值得继续什么？' },
  research: { title: '文献雷达', sub: 'Latest-50 论文 · 去重 · 证据标注报告 · 飞书发布（审批）' },
  communication: { title: '导师沟通', sub: '消息理解 · 多语气草稿 · 不虚构进度' },
  life: { title: '生活', sub: '食物地图 · 志愿台账 · 健身训练' },
  automation: { title: '自动化', sub: '工作流运行历史 · 技能配方 · 表单助手' },
  memory: { title: '记忆中心', sub: '本地优先 · 可检查 · 溯源标注' },
  connections: { title: '连接', sub: '飞书优先 · 审批门控 · 能力发现' },
}

// ── theme-adaptive palette ──────────────────────────────────────────────────

export interface Palette {
  bg: string
  fg: string
  border: string
  cardBg: string
  muted: string
  accent: string
  accentSoft: string
  danger: string
  warn: string
  ok: string
}

function parseRgb(color: string): [number, number, number] {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  const hex = color.replace('#', '')
  if (hex.length >= 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  return [255, 255, 255]
}
const lum = ([r, g, b]: [number, number, number]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`

function derivePalette(): Palette {
  const cs = getComputedStyle(document.body)
  const bg = cs.backgroundColor || 'rgb(255,255,255)'
  const fg = cs.color || 'rgb(15,17,21)'
  const bgC = parseRgb(bg)
  const fgC = parseRgb(fg)
  const light = lum(bgC) > 0.5
  return {
    bg,
    fg,
    border: rgba(fgC, light ? 0.14 : 0.16),
    cardBg: light ? 'rgba(255,255,255,0.85)' : rgba(fgC, 0.05),
    muted: rgba(fgC, 0.58),
    accent: light ? '#3f66f0' : '#7c9cff',
    accentSoft: rgba(light ? [63, 102, 240] : [124, 156, 255], 0.14),
    danger: '#cc4b4b',
    warn: '#c77c1d',
    ok: '#2e9e5b',
  }
}

function useThemePalette(): Palette {
  const [pal, setPal] = useState(derivePalette)
  useEffect(() => {
    const obs = new MutationObserver(() => setPal(derivePalette()))
    obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => obs.disconnect()
  }, [])
  return pal
}

async function jget(url: string): Promise<unknown> {
  const r = await fetch(url)
  return r.json()
}

// ── primitives ──────────────────────────────────────────────────────────────

function Card(props: { pal: Palette; children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  const { pal } = props
  return (
    <div
      onClick={props.onClick}
      style={{
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
        background: pal.cardBg,
        padding: '12px 14px',
        ...(props.onClick ? { cursor: 'pointer' } : {}),
        ...props.style,
      }}
      onMouseEnter={(e) => props.onClick && (e.currentTarget.style.borderColor = pal.accent)}
      onMouseLeave={(e) => props.onClick && (e.currentTarget.style.borderColor = pal.border)}
    >
      {props.children}
    </div>
  )
}

function Btn(props: { pal: Palette; children: ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean }) {
  const { pal } = props
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        padding: '6px 14px',
        fontSize: 12.5,
        borderRadius: 8,
        cursor: props.disabled ? 'default' : 'pointer',
        border: `1px solid ${props.primary ? pal.accent : pal.border}`,
        background: props.primary ? pal.accent : 'transparent',
        color: props.primary ? '#fff' : pal.fg,
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {props.children}
    </button>
  )
}

const inputStyle = (pal: Palette): CSSProperties => ({
  width: '100%',
  padding: '7px 10px',
  fontSize: 12.5,
  borderRadius: 8,
  border: `1px solid ${pal.border}`,
  background: 'transparent',
  color: pal.fg,
  outline: 'none',
  boxSizing: 'border-box',
})

// ── section surfaces ────────────────────────────────────────────────────────

function HealthLine({ pal }: { pal: Palette }) {
  const [h, setH] = useState<{ version?: string; workflows?: Array<{ id: string }> } | null>(null)
  useEffect(() => {
    jget(`${API}/health`).then((d) => setH(d as typeof h))
  }, [])
  return (
    <p style={{ fontSize: 12, color: pal.muted, margin: '4px 0' }}>
      {h ? `host v${h.version} · workflows: ${(h.workflows ?? []).map((w) => w.id).join(', ')}` : 'host offline'}
    </p>
  )
}

function Dashboard({ pal, onNavigate }: { pal: Palette; onNavigate: (s: SectionId) => void }) {
  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>今天最值得继续什么？</h1>
      <p style={{ fontSize: 12.5, color: pal.muted, margin: '0 0 18px' }}>捕获 → 路由 → 工作流 → 工件 → 审批 → 连接器</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { title: '文献雷达', desc: '最新 50 篇 · 证据标注报告', target: 'research' as SectionId, cta: '开始检索' },
          { title: '导师沟通', desc: '理解消息 · 起草回复', target: 'communication' as SectionId, cta: '草拟回复' },
          { title: '生活台账', desc: '志愿时长 · 健身 · 美食地图', target: 'life' as SectionId, cta: '记录一笔' },
        ].map((c) => (
          <Card key={c.title} pal onClick={() => onNavigate(c.target)} style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: pal.muted, marginTop: 5 }}>{c.desc}</div>
            <div style={{ fontSize: 12, color: pal.accent, marginTop: 10, fontWeight: 600 }}>{c.cta} →</div>
          </Card>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 24, marginBottom: 10 }}>模块入口</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {[
          { title: '文献雷达', desc: 'Latest-50 论文', target: 'research' as SectionId, icon: '🔬' },
          { title: '导师沟通', desc: '理解 + 草稿', target: 'communication' as SectionId, icon: '💬' },
          { title: '生活', desc: '美食 / 台账', target: 'life' as SectionId, icon: '🍜' },
          { title: '自动化', desc: '工作流 / 技能', target: 'automation' as SectionId, icon: '⚙️' },
          { title: '记忆中心', desc: '溯源记忆', target: 'memory' as SectionId, icon: '🧠' },
          { title: '连接', desc: '飞书审批', target: 'connections' as SectionId, icon: '🔗' },
        ].map((m) => (
          <Card key={m.title} pal onClick={() => onNavigate(m.target)} style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 18 }}>{m.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{m.title}</div>
            <div style={{ fontSize: 11, color: pal.muted, marginTop: 3 }}>{m.desc}</div>
          </Card>
        ))}
      </div>
      <Card pal style={{ marginTop: 20, padding: '14px 18px' }}>
        <HealthLine pal={pal} />
      </Card>
    </div>
  )
}

interface RadarPaper {
  title: string
  year?: number
  evidenceLevel: string
  doi?: string
}

/** Research radar projection (deterministic evidence-tagged cards). */
function ResearchSection({ pal }: { pal: Palette }) {
  const [state, setState] = useState<{ topic: string; papers?: RadarPaper[]; note?: string; busy?: boolean }>({ topic: '' })
  const run = async () => {
    const topic = state.topic.trim()
    if (!topic) return
    setState({ ...state, busy: true, note: undefined })
    try {
      const r = await fetch(`${API}/research/collections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, count: 10 }),
      })
      const d = await r.json()
      setState({ ...state, papers: d.papers ?? [], note: d.note, busy: false })
    } catch {
      setState({ ...state, busy: false, note: '检索失败（提供方限流或不可用）' })
    }
  }
  return (
    <div style={{ padding: '18px 22px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          style={inputStyle(pal)}
          placeholder="研究主题，如 LLM agent memory"
          value={state.topic}
          onChange={(e) => setState({ ...state, topic: e.target.value })}
        />
        <Btn pal primary disabled={state.busy} onClick={run}>{state.busy ? '检索中…' : '收集 10 篇'}</Btn>
      </div>
      {state.note ? <p style={{ fontSize: 12, color: pal.warn, margin: '6px 0' }}>{state.note}</p> : null}
      {(state.papers ?? []).map((p) => (
        <Card key={p.title} pal style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: pal.accentSoft, color: pal.accent }}>
              {p.evidenceLevel === 'metadata' ? '[M]' : '[A]'}
            </span>
            <strong style={{ fontSize: 13, flex: 1 }}>{p.title}</strong>
            <span style={{ fontSize: 11, color: pal.muted }}>{p.year ?? ''}</span>
          </div>
          {p.doi ? <div style={{ fontSize: 11, color: pal.muted, marginTop: 4, wordBreak: 'break-all' }}>https://doi.org/{p.doi}</div> : null}
        </Card>
      ))}
    </div>
  )
}

function SectionPlaceholder({ title, desc, pal }: { title: string; desc: string; pal: Palette }) {
  return (
    <div style={{ padding: '18px 22px', height: '100%', overflow: 'auto' }}>
      <Card pal>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: pal.muted, marginTop: 6 }}>{desc}</div>
      </Card>
    </div>
  )
}

// ── shell frame ─────────────────────────────────────────────────────────────

export interface RenderSlot {
  (name: string, props: Record<string, unknown>): ReactElement | null
}

function ShellFrame({ renderSlot }: { renderSlot: RenderSlot }) {
  const pal = useThemePalette()
  const [active, setActiveState] = useState<SectionId>(loadSection)
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1180)
  const [agentOpen, setAgentOpen] = useState(true)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 1180)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const navigate = (s: SectionId) => {
    setActiveState(s)
    try {
      sessionStorage.setItem(NAV_KEY, s)
    } catch {
      /* ignore */
    }
  }

  const S = styles(pal)
  const agentStyle = narrow
    ? {
        position: 'fixed' as const,
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(400px, 92vw)',
        zIndex: 70,
        background: pal.bg,
        display: agentOpen ? ('flex' as const) : ('none' as const),
        flexDirection: 'column' as const,
        boxShadow: '-8px 0 28px rgba(0,0,0,0.22)',
      }
    : ({ ...S.chatCol, display: 'flex' } as CSSProperties)

  return (
    <div data-grad-shell="v1" style={S.frame as CSSProperties}>
      <aside style={S.nav as CSSProperties} data-grad-nav="single">
        <div style={S.brand}>
          <div style={S.brandTitle}>🎓 Graduate OS</div>
          <div style={S.brandSub}>task-first · memory-aware · approval-gated</div>
        </div>
        <nav style={S.navList} data-grad-navlist>
          {NAV.map((g) => (
            <div key={g.group}>
              <div style={S.navGroup}>{g.group}</div>
              {g.items.map((n) => (
                <div
                  key={n.id}
                  style={S.navItem(active === n.id)}
                  onClick={() => navigate(n.id)}
                  role="tab"
                  aria-selected={active === n.id}
                >
                  <span style={{ fontSize: 14 }}>{n.icon}</span>
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main style={S.main as CSSProperties} data-grad-main>
        <div style={S.mainHeader}>
          <span style={S.mainTitle} data-grad-title>{SECTION_META[active].title}</span>
          <span style={S.mainSub}>{SECTION_META[active].sub}</span>
        </div>
        <div style={S.mainBody}>
          <div style={S.pane} data-grad-section={active}>
            {active === 'dashboard' && <Dashboard pal={pal} onNavigate={navigate} />}
            {active === 'research' && <ResearchSection pal={pal} />}
            {active === 'communication' && (
              <SectionPlaceholder pal={pal} title="导师沟通" desc="消息理解与多语气草稿 —— 通过 /api/grad/communication 接入。" />
            )}
            {active === 'life' && <SectionPlaceholder pal={pal} title="生活" desc="食物地图 · 志愿台账 · 健身训练 —— 数据与 API 已就绪。" />}
            {active === 'automation' && <SectionPlaceholder pal={pal} title="自动化" desc="工作流运行历史 · 技能配方 —— 通过 grad_run_workflow / grad_skill_* 驱动。" />}
            {active === 'memory' && <SectionPlaceholder pal={pal} title="记忆中心" desc="本地优先记忆：FTS 检索 · 候选确认 · 敏感性控制。" />}
            {active === 'connections' && <SectionPlaceholder pal={pal} title="连接" desc="飞书连接器（审批门控） · 能力发现 · 健康检查。" />}
          </div>
        </div>
      </main>
      <section style={agentStyle} data-grad-agent data-grad-agent-open={agentOpen ? '1' : '0'}>
        <div style={S.chatHeader}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Agent</span>
          {narrow && (
            <button
              type="button"
              onClick={() => setAgentOpen(false)}
              style={{ border: 'none', background: 'none', color: pal.fg, cursor: 'pointer', fontSize: 12 }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={S.chatBody}>{renderSlot('conversation', {})}</div>
      </section>
      {narrow && !agentOpen ? (
        <button type="button" style={S.fab as CSSProperties} onClick={() => setAgentOpen(true)} data-grad-agent-fab>
          💬 Agent
        </button>
      ) : null}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }} data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
    </div>
  )
}

function styles(pal: Palette) {
  return {
    frame: { display: 'flex', height: '100%', minHeight: 0 },
    nav: {
      width: 232,
      flex: 'none',
      borderRight: `1px solid ${pal.border}`,
      padding: '10px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      overflowY: 'auto',
      boxSizing: 'border-box',
    },
    brand: { padding: '6px 10px 12px' },
    brandTitle: { fontSize: 14, fontWeight: 800 },
    brandSub: { fontSize: 10.5, color: pal.muted, marginTop: 2 },
    navList: { display: 'flex', flexDirection: 'column', gap: 8 },
    navGroup: { fontSize: 10.5, color: pal.muted, padding: '6px 10px 2px', letterSpacing: 0.4, textTransform: 'uppercase' },
    navItem: (active: boolean): CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 10px',
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 13,
      border: 'none',
      color: pal.fg,
      background: active ? pal.accentSoft : 'transparent',
      fontWeight: active ? 600 : 400,
    }),
    main: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' },
    mainHeader: { display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 20px 8px', borderBottom: `1px solid ${pal.border}` },
    mainTitle: { fontSize: 16, fontWeight: 800 },
    mainSub: { fontSize: 12, color: pal.muted },
    mainBody: { flex: '1 1 auto', minHeight: 0, overflow: 'hidden' },
    pane: { height: '100%', overflow: 'hidden' },
    chatCol: {
      width: 360,
      flex: 'none',
      borderLeft: `1px solid ${pal.border}`,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    },
    chatHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${pal.border}` },
    chatBody: { flex: 1, minHeight: 0, overflow: 'hidden' },
    fab: {
      position: 'fixed',
      right: 18,
      bottom: 18,
      zIndex: 60,
      borderRadius: 999,
      border: `1px solid ${pal.border}`,
      background: pal.cardBg,
      color: pal.fg,
      padding: '9px 16px',
      fontSize: 13,
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    },
  }
}

function loadSection(): SectionId {
  try {
    const v = sessionStorage.getItem(NAV_KEY)
    if (v && ALL_ITEMS.some((n) => n.id === v)) return v as SectionId
  } catch {
    /* ignore */
  }
  return 'dashboard'
}

export const inject = ['slots', 'sessions']

type ShellClientContext = {
  slots: {
    register(meta: unknown, component: unknown): () => void
  }
  reflect: {
    provide(name: string, value: unknown): () => void
  }
  effect(setup: () => (() => void) | void, label?: string): void
}

export function apply(ctx: ShellClientContext): void {
  const disposeLayout = ctx.reflect.provide('layout', {
    toggleSidebar() {},
    openDetails() {},
    closeDetails() {},
  })

  const disposeRoot = ctx.slots.register(
    {
      name: 'root',
      children: {
        sidebar: { kind: 'single', scope: 'root' },
        conversation: { kind: 'single', scope: 'session-maybe' },
        details: { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
        'grad.workbench': { kind: 'single', scope: 'session' },
      },
      inject: () => ({}),
    },
    ShellFrame,
  )

  ctx.effect(
    () => () => {
      disposeRoot()
      disposeLayout()
    },
    'grad-shell: dispose',
  )
}