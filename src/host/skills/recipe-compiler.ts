/**
 * Recipe compiler — composes atomic skills into linear typed recipes and
 * validates before anything can run:
 *   - unknown / duplicate skill ids
 *   - empty chains
 *   - required-input satisfaction (initial input ∪ prior step outputs)
 *   - external-side-effect skills automatically become approval-gated steps
 * Compiled recipes are ordinary WorkflowDefinitions, so run provenance,
 * approvals and artifacts behave exactly like built-in workflows.
 */

import { errors } from '../../shared/errors.ts'
import type { WorkflowDefinition, WorkflowStepDef } from '../services/workflow-engine.ts'
import type { SkillDefinition } from './catalog.ts'

export interface RecipeStepInput {
  skillId: string
  /** Static input overrides merged into the dynamic chain context. */
  staticInput?: Record<string, unknown>
}

export interface CompileResult {
  definition: WorkflowDefinition
  warnings: string[]
}

export class RecipeValidationError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`recipe invalid: ${problems.join('; ')}`)
    this.name = 'RecipeValidationError'
    this.problems = problems
  }
}

export function compileRecipe(
  catalog: Record<string, SkillDefinition>,
  services: import('../services/index.ts').HostServices,
  spec: { id: string; version?: string; title: string; steps: RecipeStepInput[] },
): CompileResult {
  const problems: string[] = []
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    problems.push('recipe needs at least one step')
  }
  const seen = new Set<string>()
  for (const [i, step] of (spec.steps ?? []).entries()) {
    const skill = catalog[step?.skillId]
    if (!skill) {
      problems.push(`step ${i + 1}: unknown skill "${String(step?.skillId)}"`)
      continue
    }
    if (seen.has(step.skillId)) problems.push(`step ${i + 1}: duplicate skill "${step.skillId}"`)
    seen.add(step.skillId)
  }
  if (problems.length > 0) throw new RecipeValidationError(problems)

  // Required-input propagation: initial input provides user keys; each step
  // adds its outputs to the available set.
  const available = new Set<string>(['topic', 'note', 'title', 'markdown', 'userFacts'])
  const warnings: string[] = []
  const producedBy: Record<string, string> = {}
  for (const [i, step] of spec.steps.entries()) {
    const skill = catalog[step.skillId]!
    const missing = skill.manifest.requiredInputs.filter((key) => !available.has(key))
    if (missing.length > 0 && !spec.steps.slice(0, i).some((s) => Boolean(s.staticInput) && missing.every((k) => k in (s.staticInput as Record<string, unknown>)))) {
      // Only warn: runtime still validates against the real dynamic context.
      warnings.push(`step ${i + 1} (${skill.manifest.id}) expects inputs not produced earlier: ${missing.join(', ')}`)
    }
    for (const out of skill.manifest.outputs) available.add(out)
    for (const key of Object.keys(step.staticInput ?? {})) available.add(key)
    void producedBy
  }

  const steps: WorkflowStepDef[] = spec.steps.map((step, index) => {
    const skill = catalog[step.skillId]!
    const isGateOwner = skill.manifest.externalSideEffect
    // BOTH the gate and the body must see the SAME merged input, otherwise the
    // approval payload hash (computed at gate time) cannot match execution.
    const mergedView = (input: unknown): unknown => mergeInputs(input, step.staticInput)
    return {
      name: `${index + 1}. ${skill.manifest.title}`,
      skillId: skill.manifest.id,
      requiresApprovals:
        skill.requiresApprovals !== undefined || isGateOwner
          ? (input) => {
              const merged = mergedView(input)
              return skill.requiresApprovals
                ? skill.requiresApprovals(merged)
                : [
                    {
                      actionType: `external.${skill.manifest.id}`,
                      summary: `External side effect via ${skill.manifest.title}`,
                      payload: merged,
                      destination: 'external system',
                    },
                  ]
            }
          : undefined,
      execute(input, engineCtx) {
        return skill.execute(mergedView(input), { ...engineCtx, services })
      },
    }
  })

  const definition: WorkflowDefinition = {
    id: spec.id,
    version: spec.version ?? '0.1.0',
    title: spec.title,
    description: `Composed recipe: ${spec.steps.map((s) => s.skillId).join(' → ')}`,
    validateInput(input) {
      if (typeof input !== 'object' || input === null) throw errors.invalidInput('recipe input must be an object')
      return input
    },
    steps,
  }

  return { definition, warnings }
}

function mergeInputs(dynamic: unknown, staticInput?: Record<string, unknown>): unknown {
  if (!staticInput) return dynamic
  const base = (typeof dynamic === 'object' && dynamic !== null ? dynamic : {}) as Record<string, unknown>
  return { ...base, ...staticInput }
}
