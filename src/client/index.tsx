/**
 * dsh-grad-workbench client entry.
 * Official DSH UI contracts only (verified rc.2 — see docs/COMPATIBILITY.md):
 * - primary: conversation.view tab「硕博工作台」
 * - sidebar.footer.action: one button that switches to the workbench view
 * - shell.overlay: fallback drawer when session tabs are unavailable
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { GradClientContext } from './context.ts'
import { GradWorkbench } from './app/GradWorkbench.tsx'

const VIEW_ID = 'grad-workbench'
const OVERLAY_EVENT = 'dsh-grad-workbench:overlay'

type SessionHelpers = {
  sessionId?: string
  setDraft?: (text: string) => void
  setView?: (id: string) => void
}

function getSessionHelpers(ctx: GradClientContext, sessionId: string | undefined): SessionHelpers {
  if (!sessionId) return {}
  try {
    const binding = ctx.sessions.binding(sessionId)
    const session = binding?.session
    return {
      sessionId,
      setDraft: (text: string) => {
        try {
          const store = session?.getSnapshot?.()
          store?.inputActions?.setDraft?.(text)
        } catch {
          /* composer not ready */
        }
      },
      setView: (viewId: string) => {
        try {
          const store = session?.getSnapshot?.()
          store?.actions?.setView?.(viewId)
        } catch {
          /* view switch unavailable */
        }
      },
    }
  } catch {
    return {}
  }
}

function WorkbenchFooter({ wide, setView, openOverlay }: {
  wide: boolean
  setView?: (id: string) => void
  openOverlay?: () => void
}) {
  return (
    <button
      type="button"
      title="硕博工作台（会话标签）"
      onClick={() => {
        if (setView) setView(VIEW_ID)
        else openOverlay?.()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: wide ? 'flex-start' : 'center',
        gap: 6,
        width: '100%',
        border: 0,
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        padding: '8px 10px',
      }}
    >
      {wide ? '🎓 硕博工作台' : '🎓'}
    </button>
  )
}

/** Fallback drawer for environments without conversation.view tabs. */
function OverlayHost(): ReactElement {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    document.addEventListener(OVERLAY_EVENT, onOpen)
    return () => document.removeEventListener(OVERLAY_EVENT, onOpen)
  }, [])
  if (!open) return <></>
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.35)',
        pointerEvents: 'auto',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: 'min(960px, 96vw)',
          height: '100%',
          background: 'var(--dsh-bg, #1a1a1a)',
          color: 'inherit',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(128,128,128,0.25)' }}>
          <strong>硕博工作台</strong>
          <button type="button" style={{ float: 'right' }} onClick={() => setOpen(false)}>
            关闭
          </button>
        </div>
        <GradWorkbench />
      </div>
    </div>
  )
}

/** @type {readonly string[]} */
export const inject = ['slots', 'sessions']

export function apply(ctx: GradClientContext): void {
  // Primary surface: session view tab.
  try {
    ctx.slots.inject('conversation.view', () =>
      ctx.slots.register(
        {
          name: 'conversation.view',
          id: VIEW_ID,
          order: 55,
          label: () => '硕博工作台',
          inject: (sessionId: string) => getSessionHelpers(ctx, sessionId),
        },
        () => <GradWorkbench />,
      ),
    )
  } catch {
    /* slot unavailable in this host build */
  }

  // Sidebar footer button (inject, not register: declared by ui-sidebar after layout).
  try {
    ctx.slots.inject('sidebar.footer.action', () =>
      ctx.slots.register(
        {
          name: 'sidebar.footer.action',
          id: 'dsh-grad-workbench-footer',
          order: 105,
          inject: () => {
            const current = ctx.sessions.list.getSnapshot?.()?.current
            const helpers = getSessionHelpers(ctx, current)
            return {
              wide: true,
              setView: helpers.setView,
              openOverlay: () => document.dispatchEvent(new CustomEvent(OVERLAY_EVENT)),
            }
          },
        },
        WorkbenchFooter,
      ),
    )
  } catch {
    /* slot unavailable */
  }

  // Fallback overlay.
  try {
    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        {
          name: 'shell.overlay',
          id: 'dsh-grad-workbench-overlay',
          order: 110,
          inject: () => ({}),
        },
        OverlayHost,
      ),
    )
  } catch {
    /* slot unavailable */
  }
}
