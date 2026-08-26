/** Graduate OS Shell host — suite composes the loader entry; host stays minimal. */
export const inject = []

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.logger.info('[grad-shell] mounted (presentation-only product chrome)')
}