import { describe, expect, it } from 'vitest'
import { getLesson, lessonsForDifficulty } from '../examples'

describe('study-book practice lessons', () => {
  it('keeps DSA pattern-identification and FastAPI dispatcher tasks in the playground', () => {
    const ids = [
      'mid-pattern-pick',
      'mid-sliding-window',
      'mid-two-pointers',
      'mid-prefix-sums',
      'mid-binsearch-answer',
      'mid-pattern-mixed',
      'api-fastapi-status',
      'api-fastapi-dispatch',
    ]
    for (const id of ids) {
      const lesson = getLesson(id)
      expect(lesson.id, id).toBe(id)
      expect(lesson.code).toContain('???')
      expect(lesson.bookChapter).toBeTruthy()
      expect(lesson.tasks.length).toBeGreaterThanOrEqual(3)
    }
    expect(lessonsForDifficulty('intermediate').some((l) => l.id === 'mid-pattern-pick')).toBe(
      true,
    )
    expect(lessonsForDifficulty('api').map((l) => l.id)).toContain('api-fastapi-dispatch')
  })
})
