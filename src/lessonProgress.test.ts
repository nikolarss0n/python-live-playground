import { describe, expect, it } from 'vitest'
import { getLesson } from './examples'
import { buildLessonProgress, isIncompleteAttempt } from './lessonProgress'
import type { Lesson } from './examples'

const lesson: Lesson = {
  id: 'printing',
  difficulty: 'beginner',
  number: 1,
  topic: 'Printing',
  chapter: 'Basics',
  goal: 'Two messages',
  tasks: [
    'Change the first print so it greets you by name',
    'Fill in the second print (replace ???)',
  ],
  taskInstructions: [
    'Edit the first print call.',
    'Replace the blank with quoted text.',
  ],
  code: 'print("Hello")\nprint(???)',
}

describe('buildLessonProgress', () => {
  it('does not mark a fill-in task done just because ??? is gone', () => {
    const view = buildLessonProgress(
      lesson,
      'print("Hi Ada")\nprint("yo")',
      { met: false, missing: ['Run your code'] },
      'ready',
      [],
      { stuckRevealed: false, incompleteRunCount: 0 },
    )
    expect(view.tasks[0]?.status).toBe('todo')
    expect(view.tasks[1]?.status).toBe('todo')
    expect(view.tasks[1]?.instruction).toBe(
      'Replace the blank with quoted text.',
    )
    expect(view.next).toBe('Run your code')
  })

  it('marks printing tasks done only when the latest successful run printed the evidence', () => {
    const printing = getLesson('printing')
    const code = 'print("Hi Ada")\nprint("I code")\n'
    const view = buildLessonProgress(
      printing,
      code,
      { met: true, missing: [] },
      'success',
      [
        { kind: 'print', text: 'Hi Ada', line: 1 },
        { kind: 'print', text: 'I code', line: 2 },
      ],
      {
        stuckRevealed: false,
        incompleteRunCount: 0,
        executedCode: code,
      },
    )
    expect(view.tasks.every((task) => task.status === 'done')).toBe(true)
    expect(view.currentEvidence?.summary).toMatch(/Hi Ada/)
  })

  it('keeps a print-word task todo when the successful run has no prints', () => {
    const printing = getLesson('printing')
    const code = 'x = 1'
    const view = buildLessonProgress(
      printing,
      code,
      { met: false, missing: ['Print at least 2 non-empty line(s)'] },
      'success',
      [{ kind: 'expr', value: '1', line: 1 }],
      {
        stuckRevealed: false,
        incompleteRunCount: 0,
        executedCode: code,
      },
    )
    expect(view.tasks[0]?.status).toBe('todo')
    expect(view.currentEvidence?.summary).toMatch(/print/i)
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
