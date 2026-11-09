import { describe, expect, it } from 'vitest'
import { getLesson } from './examples'
import { explainError } from './execution/errorExplain'
import type { ResultEvent } from './execution/protocol'
import {
  enrichResultEvents,
  evaluateEssentialsTasks,
  taskEvidenceLine,
  withLessonAwareErrorTip,
} from './taskEvidence'

function print(text: string, line = 1): ResultEvent {
  return { kind: 'print', text, line }
}

function expr(value: string, line = 1): ResultEvent {
  return { kind: 'expr', value, line }
}

function errorEvent(message: string, line = 6): ResultEvent {
  return {
    kind: 'error',
    message,
    friendly: message,
    traceback: message,
    line,
  }
}

describe('evaluateEssentialsTasks — printing', () => {
  const lesson = getLesson('printing')

  it('does not complete the current task while ??? remains, and evidence names the missing fill', () => {
    const run = {
      code: lesson.code,
      executedCode: lesson.code,
      status: 'error' as const,
      events: [errorEvent("NameError: name '???' is not defined")],
    }

    const tasks = evaluateEssentialsTasks(lesson, run)
    expect(tasks[0]?.done).toBe(false)
    expect(tasks[1]?.done).toBe(false)

    const line = taskEvidenceLine(lesson, run)
    expect(line).toBeTruthy()
    expect(line).toMatch(/\?\?\?/)
    expect(line).toMatch(/print/i)
    expect(line).not.toMatch(/advanced/i)
  })

  it('marks tasks done only after a successful run whose prints satisfy them, and cites those prints', () => {
    const code = 'print("Hi Ada")\nprint("I code")\n'
    const run = {
      code,
      executedCode: code,
      status: 'success' as const,
      events: [print('Hi Ada', 1), print('I code', 2)],
    }

    const tasks = evaluateEssentialsTasks(lesson, run)
    expect(tasks.every((task) => task.done)).toBe(true)

    const line = taskEvidenceLine(lesson, run)
    expect(line).toMatch(/advanced/i)
    expect(line).toContain('Hi Ada')
    expect(line).toContain('I code')
  })

  it('does not mark the second print task done from a single printed line', () => {
    const code = 'print("Hi Ada")'
    const run = {
      code,
      executedCode: code,
      status: 'success' as const,
      events: [print('Hi Ada', 1)],
    }

    const tasks = evaluateEssentialsTasks(lesson, run)
    expect(tasks[0]?.done).toBe(true)
    expect(tasks[1]?.done).toBe(false)

    const line = taskEvidenceLine(lesson, run)
    expect(line).toMatch(/second print|two|another print/i)
    expect(line).not.toMatch(/advanced/i)
    expect(line).toContain('Hi Ada')
  })

  it('does not mark a print task done just because the task text says “print”', () => {
    const code = 'x = 1'
    const run = {
      code,
      executedCode: code,
      status: 'success' as const,
      events: [expr('1', 1)],
    }

    const tasks = evaluateEssentialsTasks(lesson, run)
    expect(tasks[0]?.done).toBe(false)
    expect(tasks[1]?.done).toBe(false)

    const line = taskEvidenceLine(lesson, run)
    expect(line).toMatch(/print/i)
    expect(line).not.toMatch(/advanced/i)
  })
})

describe('evaluateEssentialsTasks — variables', () => {
  const lesson = getLesson('variables')

  it('does not complete the name fill while ??? remains, and evidence names that fill', () => {
    const run = {
      code: lesson.code,
      executedCode: lesson.code,
      status: 'error' as const,
      events: [errorEvent("SyntaxError: invalid syntax", 5)],
    }

    const tasks = evaluateEssentialsTasks(lesson, run)
    expect(tasks[0]?.done).toBe(false)

    const line = taskEvidenceLine(lesson, run)
    expect(line).toMatch(/\?\?\?|name/i)
    expect(line).not.toMatch(/advanced/i)
  })

  it('cites the actual greeting after a successful name fill', () => {
    const code = 'name = "Ada"\nprint(f"Hello, {name}!")\n'
    const run = {
      code,
      executedCode: code,
      status: 'success' as const,
      events: [print('Hello, Ada!', 2)],
    }

    const tasks = evaluateEssentialsTasks(lesson, run)
    expect(tasks.every((task) => task.done)).toBe(true)

    const line = taskEvidenceLine(lesson, run)
    expect(line).toMatch(/advanced/i)
    expect(line).toContain('Hello, Ada!')
  })
})

describe('evaluateEssentialsTasks — expressions', () => {
  const lesson = getLesson('expressions')

  it('does not mark “Change 2 + 2” done when that calculation is left unchanged', () => {
    const code = '2 + 2\n"Python" * 3\n10 - 3\n'
    const run = {
      code,
      executedCode: code,
      status: 'success' as const,
      events: [expr('4', 1), expr("'PythonPythonPython'", 2), expr('7', 3)],
    }

    const tasks = evaluateEssentialsTasks(lesson, run)
    expect(tasks[0]?.done).toBe(false)
    expect(taskEvidenceLine(lesson, run)).toMatch(/2 \+ 2/)
    expect(taskEvidenceLine(lesson, run)).not.toMatch(/advanced/i)
  })
})

describe('withLessonAwareErrorTip', () => {
  it('names the current printing task’s next edit when ??? causes NameError', () => {
    const lesson = getLesson('printing')
    const generic = explainError("NameError: name '???' is not defined")
    expect(generic.tip.toLowerCase()).not.toContain('second print')

    const aware = withLessonAwareErrorTip(generic, lesson, lesson.code)
    expect(aware.tip).toMatch(/replace \?\?\?/i)
    expect(aware.tip).toMatch(/second print|quoted/i)
  })

  it('names the variables fill when leftover ??? fails the run', () => {
    const lesson = getLesson('variables')
    const generic = explainError('SyntaxError: invalid syntax')
    const aware = withLessonAwareErrorTip(generic, lesson, lesson.code)
    expect(aware.tip).toMatch(/replace \?\?\?/i)
    expect(aware.tip).toMatch(/name/i)
  })

  it('keeps the reload tip when Python itself stopped', () => {
    const lesson = getLesson('variables')
    const runner = explainError('RunnerError: Python stopped working in this tab.')
    expect(withLessonAwareErrorTip(runner, lesson, lesson.code).tip).toMatch(/Reload the page/)
  })
})

describe('enrichResultEvents', () => {
  it('writes the lesson-aware tip onto the error event', () => {
    const lesson = getLesson('printing')
    const events = enrichResultEvents(lesson, lesson.code, [
      errorEvent("NameError: name '???' is not defined"),
    ])
    const err = events[0]
    expect(err?.kind).toBe('error')
    if (err?.kind !== 'error') return
    expect(err.explanation?.tip).toMatch(/replace \?\?\?/i)
    expect(err.explanation?.tip).toMatch(/second print|quoted/i)
  })
})
