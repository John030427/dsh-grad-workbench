import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Resolve the workbench data root: `~/.dsh/grad-workbench` by default.
 * `GRAD_WORKBENCH_HOME` overrides (used by tests to isolate fixtures).
 */
export function resolveDataDir(): string {
  const override = process.env.GRAD_WORKBENCH_HOME
  if (override && override.trim().length > 0) return override
  return join(homedir(), '.dsh', 'grad-workbench')
}

export type DataLayout = {
  root: string
  dbPath: string
  artifactsDir: string
  cacheDir: string
  logsDir: string
  backupsDir: string
}

export function dataLayout(root: string): DataLayout {
  return {
    root,
    dbPath: join(root, 'grad.db'),
    artifactsDir: join(root, 'artifacts'),
    cacheDir: join(root, 'cache'),
    logsDir: join(root, 'logs'),
    backupsDir: join(root, 'backups'),
  }
}
