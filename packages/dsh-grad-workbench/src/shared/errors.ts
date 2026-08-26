/** Actionable error classes — messages must tell the user what failed and what can be retried. */

export class GradError extends Error {
  readonly code: string
  readonly retryable: boolean
  /** Optional structured detail for UI/tool rendering. */
  readonly detail?: Record<string, unknown>

  constructor(code: string, message: string, opts?: { retryable?: boolean; detail?: Record<string, unknown> }) {
    super(message)
    this.name = 'GradError'
    this.code = code
    this.retryable = opts?.retryable ?? false
    this.detail = opts?.detail
  }
}

export function isGradError(e: unknown): e is GradError {
  return e instanceof GradError
}

export const errors = {
  notFound: (what: string, id: string) =>
    new GradError('NOT_FOUND', `${what} not found: ${id}`, { detail: { what, id } }),
  invalidInput: (message: string, detail?: Record<string, unknown>) =>
    new GradError('INVALID_INPUT', message, { detail }),
  approvalRequired: (action: string) =>
    new GradError('APPROVAL_REQUIRED', `Action "${action}" requires explicit user approval before it can run`, { detail: { action } }),
  approvalInvalid: (id: string, reason: string) =>
    new GradError('APPROVAL_INVALID', `Approval ${id} cannot be used: ${reason}`, { detail: { id, reason } }),
  providerFailure: (provider: string, message: string, retryable = true) =>
    new GradError('PROVIDER_FAILURE', `Academic/provider "${provider}" call failed: ${message}`, { retryable, detail: { provider } }),
  rateLimited: (provider: string, retryAfterMs?: number) =>
    new GradError('RATE_LIMITED', `Provider "${provider}" rate limit hit; retry later`, {
      retryable: true,
      detail: { provider, retryAfterMs },
    }),
  workflowState: (runId: string, from: string, to: string) =>
    new GradError('WORKFLOW_STATE', `Workflow run ${runId} cannot move from "${from}" to "${to}"`, { detail: { runId, from, to } }),
}
