import { describe, expect, it } from 'vitest'
import { LESSONS } from './examples'
import {
  TASK_INSTRUCTIONS,
  taskInstructionsFor,
} from './lessonInstructions'

describe('lesson task instructions', () => {
  it('provides specific guidance for every task in every lesson', () => {
    for (const lesson of LESSONS) {
      const instructions = TASK_INSTRUCTIONS[lesson.id]
      expect(instructions, lesson.id).toBeDefined()
      expect(instructions, lesson.id).toHaveLength(lesson.tasks.length)

      instructions?.forEach((instruction) => {
        expect(instruction.length, `${lesson.id}: ${instruction}`).toBeGreaterThan(
          55,
        )
      })
    }
  })

  it('keeps a safe actionable fallback for imported or future lessons', () => {
    expect(taskInstructionsFor('not-in-the-curriculum', ['Print one value'])).toEqual([
      expect.stringMatching(/smallest code change.*Results pane/i),
    ])
  })
})
