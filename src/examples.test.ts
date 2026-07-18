import { describe, expect, it } from 'vitest'
import {
  LESSONS,
  getLesson,
  lessonLabel,
  lessonHeading,
  lessonsForDifficulty,
  firstLessonId,
  BLANK,
  DEFAULT_LESSON_ID,
  DEFAULT_DIFFICULTY,
} from './examples'
import { evaluateGoal } from './goalCheck'

describe('lessons', () => {
  it('has beginner and intermediate tracks with interactive fields', () => {
    const beginner = lessonsForDifficulty('beginner')
    const intermediate = lessonsForDifficulty('intermediate')
    expect(beginner.length).toBeGreaterThanOrEqual(14)
    expect(intermediate.length).toBeGreaterThanOrEqual(10)

    for (const track of [beginner, intermediate]) {
      track.forEach((lesson, index) => {
        expect(lesson.number).toBe(index + 1)
        expect(lesson.topic.length).toBeGreaterThan(0)
        expect(lesson.goal.length).toBeGreaterThan(10)
        expect(lesson.tasks.length).toBeGreaterThan(0)
        expect(lesson.code.length).toBeGreaterThan(0)
        expect(lesson.goalCheck).toBeTruthy()
      })
    }
  })

  it('gives learners something to edit (blanks or a clear fix)', () => {
    for (const lesson of LESSONS) {
      const interactive =
        lesson.code.includes(BLANK) ||
        lesson.id === 'errors' ||
        lesson.id === 'python-for' ||
        lesson.id === 'infinite'
      expect(interactive).toBe(true)
    }
  })

  it('labels lessons and headings', () => {
    const first = getLesson(DEFAULT_LESSON_ID)
    expect(lessonLabel(first)).toMatch(/^Lesson \d+ · /)
    expect(lessonHeading(first)).toMatch(/^Beginner · Lesson /)
    expect(firstLessonId(DEFAULT_DIFFICULTY)).toBe(DEFAULT_LESSON_ID)
  })

  it('does not mark goals complete on stale runs or unfinished blanks', () => {
    const printing = getLesson('printing')
    const unfinished = evaluateGoal(printing, {
      code: printing.code,
      starterCode: printing.code,
      status: 'success',
      events: [
        { kind: 'print', text: 'Hello, world!' },
        { kind: 'print', text: 'x' },
      ],
      executedCode: printing.code,
    })
    expect(unfinished.met).toBe(false)
    expect(unfinished.missing.some((m) => /\?\?\?/.test(m) || /Replace/i.test(m))).toBe(
      true,
    )

    const code = 'print("a")\nprint("b")\n'
    const stale = evaluateGoal(printing, {
      code,
      starterCode: printing.code,
      status: 'success',
      events: [
        { kind: 'print', text: 'a' },
        { kind: 'print', text: 'b' },
      ],
      executedCode: 'print("old")\n',
    })
    expect(stale.met).toBe(false)
    expect(stale.missing.some((m) => /run again/i.test(m))).toBe(true)
  })

  it('marks printing complete only with two real prints of edited code', () => {
    const printing = getLesson('printing')
    const code = 'print("Hi Ada")\nprint("I code")\n'
    const finished = evaluateGoal(printing, {
      code,
      starterCode: printing.code,
      status: 'success',
      events: [
        { kind: 'print', text: 'Hi Ada' },
        { kind: 'print', text: 'I code' },
      ],
      executedCode: code,
    })
    expect(finished.met).toBe(true)
  })

  it('requires success for skill lessons', () => {
    const variables = getLesson('variables')
    const code = 'name = "Ada"\nprint(f"Hello, {name}!")\n'
    const failed = evaluateGoal(variables, {
      code,
      starterCode: variables.code,
      status: 'error',
      events: [],
      executedCode: code,
    })
    expect(failed.met).toBe(false)
  })
})
