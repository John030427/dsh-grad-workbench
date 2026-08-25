/** Skill Studio tools: browse the catalog and compose validated recipes. */

import { isGradError } from '../../shared/errors.ts'
import type { HostServices } from '../services/index.ts'
import type { ToolDefinition } from '../types.ts'
import { defineGradTool, objectSchema } from './define.ts'

export function makeSkillStudioTools(services: HostServices): ToolDefinition[] {
  const list = defineGradTool({
    name: 'grad_skill_list',
    description:
      'List atomic skills available to Skill Studio with their input/output contracts and whether they perform external side effects.',
    parameters: {},
    outputSchema: objectSchema(
      {
        ok: { type: 'boolean' },
        skills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              requiredInputs: { type: 'array', items: { type: 'string' } },
              outputs: { type: 'array', items: { type: 'string' } },
              externalSideEffect: { type: 'boolean' },
            },
            required: ['id', 'title'],
            additionalProperties: false,
          },
        },
        recipes: {
          type: 'array',
          items: { type: 'object', properties: { recipeId: { type: 'string' }, title: { type: 'string' } }, required: ['recipeId', 'title'], additionalProperties: false },
        },
      },
      ['ok', 'skills', 'recipes'],
    ),
    execute() {
      return Promise.resolve({
        ok: true,
        skills: services.studio.listSkills().map((m) => ({
          id: m.id,
          title: m.title,
          requiredInputs: m.requiredInputs,
          outputs: m.outputs,
          externalSideEffect: m.externalSideEffect,
        })),
        recipes: services.studio.listRecipes(),
      })
    },
  })

  const compose = defineGradTool({
    name: 'grad_skill_compose_recipe',
    description:
      'Compose and validate a recipe from 2+ atomic skills (linear chain). Side-effect skills automatically gain an approval gate. Returns a runnable workflow id; run it via grad_run_workflow.',
    parameters: {
      title: { type: 'string', required: true },
      steps: {
        type: 'array',
        description: 'Ordered skill ids, e.g. ["academic-retrieval","literature-synthesis"]',
        items: { type: 'object', properties: { skillId: { type: 'string' }, staticInput: { type: 'object', properties: {}, required: [], additionalProperties: true } }, required: ['skillId'], additionalProperties: false },
        required: true,
      },
    },
    outputSchema: objectSchema(
      { ok: { type: 'boolean' }, recipeId: { type: 'string' }, warnings: { type: 'array', items: { type: 'string' } }, hint: { type: 'string' } },
      ['ok', 'recipeId'],
    ),
    async execute(args) {
      const a = args as { title: string; steps: Array<{ skillId: string; staticInput?: Record<string, unknown> }> }
      try {
        const result = services.studio.compose({ title: a.title, steps: a.steps })
        return {
          ok: true,
          ...result,
          hint: `Run it with grad_run_workflow workflowId="${result.recipeId}".`,
        }
      } catch (err) {
        if (isGradError(err)) throw err
        throw err
      }
    },
  })

  return [list, compose]
}
