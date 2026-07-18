import { describe, expect, it } from 'vitest'
import { buildLessonProgress, isIncompleteAttempt } from './lessonProgress'
import type { Lesson } from './examples'

const lesson: Lesson = {
  id: 'printing',
  difficulty: 'beginner',
  number: 1,
  topic: 'Printing',
  goal: 'Two messages',
  tasks: [
    'Change the first print so it greets you by name',
    'Fill in the second print (replace ???)',
  ],
  code: 'print("Hello")\nprint(???)',
}

describe('buildLessonProgress', () => {
  it('marks fill-in task done when blanks are gone', () => {
    const view = buildLessonProgress(
      lesson,
      'print("Hi Ada")\nprint("yo")',
      { met: false, missing: ['Run your code'] },
      'ready',
      [],
      { stuckRevealed: false, incompleteRunCount: 0 },
    )
    expect(view.tasks[1]?.status).toBe('done')
    expect(view.next).toBe('Run your code')
  })

  it('shows stuck control after two incomplete runs', () => {
    const view = buildLessonProgress(
      lesson,
      lesson.code,
      {
        met: false,
        missing: ['Replace every ??? with real code', 'Run your code'],
      },
      'error',
      [],
      { stuckRevealed: false, incompleteRunCount: 2 },
    )
    expect(view.showStuckControl).toBe(true)
    expect(view.extraHint).toBeNull()
  })

  it('reveals extra hint when stuck is opened', () => {
    const view = buildLessonProgress(
      lesson,
      lesson.code,
      {
        met: false,
        missing: ['Replace every ??? with real code', 'Run your code'],
      },
      'error',
      [],
      { stuckRevealed: true, incompleteRunCount: 3 },
    )
    expect(view.extraHint).toBe('Run your code')
  })
})

describe('isIncompleteAttempt', () => {
  it('counts finished non-met runs', () => {
    expect(
      isIncompleteAttempt('success', { met: false, missing: ['x'] }),
    ).toBe(true)
    expect(isIncompleteAttempt('success', { met: true, missing: [] })).toBe(
      false,
    )
    expect(isIncompleteAttempt('running', { met: false, missing: ['x'] })).toBe(
      false,
    )
  })
})
