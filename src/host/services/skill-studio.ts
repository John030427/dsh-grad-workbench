/** Skill Studio facade: catalog browsing, recipe composition and registration. */

import { errors } from '../../shared/errors.ts'
import type { IDisposable } from '../types.ts'
import type { HostServices } from './index.ts'
import { createSkillCatalog, type SkillDefinition, type SkillManifest } from '../skills/catalog.ts'
import { compileRecipe, RecipeValidationError, type RecipeStepInput } from '../skills/recipe-compiler.ts'
import type { WorkflowDefinition } from './workflow-engine.ts'

export class SkillStudioService {
  readonly catalog: Record<string, SkillDefinition>
  private readonly recipes = new Map<string, { definition: WorkflowDefinition; dispose: IDisposable }>()
  private readonly services: HostServices

  constructor(services: HostServices) {
    this.services = services
    this.catalog = createSkillCatalog(services)
  }

  listSkills(): SkillManifest[] {
    return Object.values(this.catalog)
      .map((s) => s.manifest)
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  getSkill(id: string): SkillManifest | undefined {
    return this.catalog[id]?.manifest
  }

  /**
   * Validate + compile a recipe and register it as a runnable workflow.
   * Throws RecipeValidationError with all problems listed.
   */
  compose(spec: { title: string; steps: RecipeStepInput[] }): { recipeId: string; warnings: string[] } {
    if (!spec.title || spec.title.trim().length === 0) throw errors.invalidInput('recipe title is required')
    const recipeId = `recipe-${crypto.randomUUID().slice(0, 8)}`
    let result: ReturnType<typeof compileRecipe>
    try {
      result = compileRecipe(this.catalog, this.services, {
        id: recipeId,
        version: '0.1.0',
        title: spec.title.trim(),
        steps: spec.steps,
      })
    } catch (err) {
      if (err instanceof RecipeValidationError) throw errors.invalidInput(err.message)
      throw err
    }

    this.recipes.set(recipeId, { definition: result.definition, dispose: this.services.workflows.register(result.definition) })
    return { recipeId, warnings: result.warnings }
  }

  listRecipes(): Array<{ recipeId: string; title: string; steps: string }> {
    return [...this.recipes.entries()].map(([id, r]) => ({
      recipeId: id,
      title: r.definition.title,
      steps: r.definition.description ?? '',
    }))
  }

  disposeAll(): void {
    for (const { dispose } of this.recipes.values()) dispose()
    this.recipes.clear()
  }
}
