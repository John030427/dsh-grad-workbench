/**
 * Local structural types for the DSH client runtime contracts we consume.
 * Runtime-identical to the real ClientContext face (see docs/COMPATIBILITY.md);
 * declared locally because @deepseek-ai packages are not on the public registry.
 */

import type { ReactElement } from 'react'

export interface SlotMeta<P> {
  name: string
  id: string
  order?: number
  label?: () => string
  /** Props factory invoked per session when the slot materializes. */
  inject: (sessionId: string) => P
}

export interface SlotsService {
  /** Register into a named host slot; the callback runs once the slot exists. */
  inject(slotName: string, register: () => { (): void }): void
  /** Register one component provider for a slot; returns its disposer. */
  register<P>(meta: SlotMeta<P>, component: (props: P) => ReactElement): () => void
}

export interface SessionLike {
  getSnapshot?(): {
    inputActions?: { setDraft?(text: string): void }
    actions?: { setView?(id: string): void }
  } | undefined
}

export interface SessionsService {
  binding(sessionId: string): { session?: SessionLike } | undefined
  list: {
    getSnapshot?(): { current?: string } | undefined
  }
}

/** The slice of the DSH browser ClientContext this plugin touches. */
export type GradClientContext = {
  slots: SlotsService
  sessions: SessionsService
}
