/**
 * Honest current-task evidence for Python basics.
 * Task done-ness follows the latest finished run’s code and output,
 * not “??? is gone” or the word “print” in the task copy.
 */

import { BLANK, collectExprs, collectPrints, normalizeCode } from './goalCheck'
import type { Lesson } from './examples'
import {
  explainError,
  lineFromSource,
  type ErrorExplanation,
} from './execution/errorExplain'
import type { ExecutionStatus, ResultEvent } from './execution/protocol'

export type RunInput = {
  code: string
  executedCode: string | null
  status: ExecutionStatus
  events: readonly ResultEvent[]
}

export type TaskEvidence = {
  taskIndex: number
  taskText: string
  instruction: string | null
  done: boolean
  summary: string
}

const FINISHED: ReadonlySet<ExecutionStatus> = new Set([
  'success',
  'error',
  'timeout',
  'stopped',
])

export function isFinishedRun(status: ExecutionStatus): boolean {
  return FINISHED.has(status)
}

export function isFreshSuccess(run: RunInput): boolean {
  if (run.status !== 'success' || !run.executedCode) return false
  return normalizeCode(run.executedCode) === normalizeCode(run.code)
}

function quote(text: string): string {
  const clipped = text.replace(/\s+/g, ' ').trim()
  const short = clipped.length > 72 ? `${clipped.slice(0, 69)}…` : clipped
  return `“${short}”`
}

function firstPrintFromStarter(code: string): string | null {
  const match = /print\(\s*["']([^"']*)["']\s*\)/.exec(code)
  return match?.[1] ?? null
}

function citeOutput(prints: string[], exprs: string[]): string | null {
  if (prints.length === 1) return `this run printed ${quote(prints[0])}`
  if (prints.length > 1) {
    return `this run printed ${quote(prints[0])} and ${quote(prints[prints.length - 1])}`
  }
  if (exprs.length > 0) return `this run showed ${quote(exprs[0])}`
  return null
}

function needsPrintedEvidence(text: string, instruction: string | null): boolean {
  const hay = `${text}\n${instruction ?? ''}`.toLowerCase()
  return /\bprint|\bgreet|\bgreeting|\bmessage|\baverage|\bpass\b|\bretry/.test(
    hay,
  )
}

function needsExpressionEvidence(
  text: string,
  instruction: string | null,
): boolean {
  const hay = `${text}\n${instruction ?? ''}`.toLowerCase()
  return /expression|comparison|on the right|show (a |the )?value/.test(hay)
}

function isFillTask(text: string): boolean {
  return (
    text.includes('???') ||
    /\breplace\b|\bfill\b|\bset \w+|\bcomplete\b|\bfix\b/i.test(text)
  )
}

function isFirstPrintTask(text: string): boolean {
  return /greet|first print|change the first/i.test(text)
}

function needsSecondPrint(
  text: string,
  instruction: string | null,
): boolean {
  const hay = `${text}\n${instruction ?? ''}`.toLowerCase()
  return /second print|two (separate )?lines|two messages/.test(hay)
}

function changeSnippet(taskText: string): string | null {
  const match = /change\s+(.+?)\s+into/i.exec(taskText)
  return match?.[1]?.trim() ?? null
}

function codeStillHasSnippet(code: string, snippet: string): boolean {
  const body = code
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
  return body.replace(/\s+/g, '').includes(snippet.replace(/\s+/g, ''))
}

function fillNextEdit(lesson: Lesson): string {
  const indexed = lesson.tasks.map((text, index) => ({
    text,
    instruction: lesson.taskInstructions?.[index] ?? null,
  }))
  const fill =
    indexed.find(
      (task) =>
        task.text.includes('???') ||
        /replace|fill in|set \w+/i.test(task.text),
    ) ?? indexed[0]
  if (fill?.instruction) return fill.instruction
  if (fill) return `Replace ??? to finish: ${fill.text}`
  return 'Replace every ??? with real Python for the current task.'
}

function missingForTask(input: {
  lesson: Lesson
  run: RunInput
  taskText: string
  instruction: string | null
  prints: string[]
  exprs: string[]
}): string[] {
  const { lesson, run, taskText, instruction, prints, exprs } = input
  const missing: string[] = []
  const hasBlank = run.code.includes(BLANK)
  const fill = isFillTask(taskText) || hasBlank

  if (!isFinishedRun(run.status)) {
    missing.push('run your code')
    return missing
  }

  if (run.status !== 'success') {
    if (hasBlank) {
      missing.push(fillNextEdit(lesson))
    } else {
      missing.push('fix the error so this task can produce output')
    }
  } else if (!isFreshSuccess(run)) {
    missing.push('run again after your latest edits')
  }

  if (hasBlank && fill && !missing.some((item) => item.includes('???'))) {
    missing.push(fillNextEdit(lesson))
  }

  if (needsPrintedEvidence(taskText, instruction) && prints.length === 0) {
    missing.push(`this run produced no printed line for “${taskText}”`)
  }

  if (
    needsExpressionEvidence(taskText, instruction) &&
    exprs.length === 0 &&
    prints.length === 0
  ) {
    missing.push(`this run showed no expression value for “${taskText}”`)
  }

  if (isFirstPrintTask(taskText) && prints[0]) {
    const starterPrint = firstPrintFromStarter(lesson.code)
    if (starterPrint && prints[0] === starterPrint) {
      missing.push(
        `this run printed ${quote(prints[0])} — change that first print so it greets you by name`,
      )
    }
  }

  if (needsSecondPrint(taskText, instruction) && prints.length < 2) {
    missing.push('this run needs a second print')
  }

  const snippet = changeSnippet(taskText)
  if (snippet && codeStillHasSnippet(run.code, snippet)) {
    missing.push(
      `this run still has ${snippet} — change it into a different calculation`,
    )
  }

  return missing
}

function summaryFor(
  done: boolean,
  missing: string[],
  outputCite: string | null,
): string {
  if (done) {
    return outputCite
      ? `Current task advanced: ${outputCite}.`
      : 'Current task advanced.'
  }
  const reason = missing[0] ?? 'the current task still needs a matching run'
  const trimmed = reason.replace(/\.$/, '')
  if (outputCite && (reason.includes('???') || !reason.includes('printed'))) {
    return `Current task did not advance: ${outputCite} — ${trimmed}.`
  }
  return `Current task did not advance: ${trimmed}.`
}

export function evaluateEssentialsTasks(
  lesson: Lesson,
  run: RunInput,
): TaskEvidence[] {
  const prints = collectPrints([...run.events]).filter((text) => text.trim())
  const exprs = collectExprs([...run.events]).filter((value) => value.trim())
  const outputCite = citeOutput(prints, exprs)
  const fresh = isFreshSuccess(run)
  const hasBlank = run.code.includes(BLANK)

  return lesson.tasks.map((taskText, taskIndex) => {
    const instruction = lesson.taskInstructions?.[taskIndex] ?? null
    const missing = missingForTask({
      lesson,
      run,
      taskText,
      instruction,
      prints,
      exprs,
    })
    const needsPrint = needsPrintedEvidence(taskText, instruction)
    const needsExpr = needsExpressionEvidence(taskText, instruction)
    const done =
      fresh &&
      !hasBlank &&
      missing.length === 0 &&
      (!needsPrint || prints.length > 0) &&
      (!needsExpr || exprs.length > 0 || prints.length > 0)

    return {
      taskIndex,
      taskText,
      instruction,
      done,
      summary: summaryFor(done, missing, outputCite),
    }
  })
}

export function taskEvidenceLine(
  lesson: Lesson,
  run: RunInput,
): string | null {
  if (lesson.difficulty !== 'beginner') return null
  if (!isFinishedRun(run.status)) return null
  const tasks = evaluateEssentialsTasks(lesson, run)
  const current = tasks.find((task) => !task.done) ?? tasks[tasks.length - 1]
  return current?.summary ?? null
}

export function withLessonAwareErrorTip(
  explanation: ErrorExplanation,
  lesson: Lesson,
  code: string,
): ErrorExplanation {
  if (lesson.difficulty !== 'beginner' || !code.includes(BLANK) || explanation.name === 'RunnerError') {
    return explanation
  }
  return {
    ...explanation,
    tip: fillNextEdit(lesson),
  }
}

export function enrichResultEvents(
  lesson: Lesson,
  code: string,
  events: readonly ResultEvent[],
): ResultEvent[] {
  return events.map((event) => {
    if (event.kind !== 'error') return event
    const base =
      event.explanation ??
      explainError(event.message, undefined, {
        sourceLine: lineFromSource(code, event.line),
      })
    return {
      ...event,
      explanation: withLessonAwareErrorTip(base, lesson, code),
    }
  })
}
