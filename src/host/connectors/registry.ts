/** Connector registry — domain code asks this layer, never external systems. */

import type { Connector, ConnectorAction, ConnectorHealth } from './types.ts'

export class ConnectorRegistry {
  private readonly connectors = new Map<string, Connector>()

  register(connector: Connector): () => void {
    this.connectors.set(connector.id, connector)
    return () => this.connectors.delete(connector.id)
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id)
  }

  require(id: string): Connector {
    const connector = this.connectors.get(id)
    if (!connector) throw new Error(`connector not found: ${id}`)
    return connector
  }

  list(): Array<{ id: string; label: string; actions: Array<ConnectorAction['type']>; notes?: string }> {
    return [...this.connectors.values()].map((c) => ({
      id: c.id,
      label: c.label,
      actions: c.capabilities().actions,
      ...(c.capabilities().notes ? { notes: c.capabilities().notes } : {}),
    }))
  }

  async healthAll(): Promise<Array<{ id: string; health: ConnectorHealth }>> {
    return Promise.all(
      [...this.connectors.values()].map(async (c) => ({ id: c.id, health: await c.health() })),
    )
  }
}
