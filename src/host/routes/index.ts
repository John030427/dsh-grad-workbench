import type { GradDatabase } from '../services/db.ts'
import type { DataLayout } from '../env.ts'
import type { WebRoute } from '../types.ts'
import { json, routeErrors } from '../http.ts'

export const API_PREFIX = '/api/grad'

export interface RouteDeps {
  version: string
  layout: DataLayout
  database: GradDatabase
  startedAt: string
}

export function makeRoutes(deps: RouteDeps): WebRoute[] {
  return [
    {
      kind: 'exact',
      path: `${API_PREFIX}/health`,
      handler: routeErrors((req, res) => {
        if (req.method !== 'GET') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const migrations = deps.database.appliedMigrations()
        json(res, 200, {
          ok: true,
          plugin: 'dsh-grad-workbench',
          version: deps.version,
          dataDir: deps.layout.root,
          migrations,
          startedAt: deps.startedAt,
          timestamp: Date.now(),
        })
      }),
    },
  ]
}
