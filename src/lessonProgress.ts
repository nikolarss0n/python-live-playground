/**
 * Soft lesson progress: task checkmarks, hint ladder, no grades.
 */

import { BLANK, type GoalProgress } from './goalCheck'
import type { Lesson } from './examples'
import type { ExecutionStatus, ResultEvent } from './execution/protocol'

export type TaskStatus = 'todo' | 'done'

export type LessonProgressView = {
  tasks: { text: string; instruction: string | null; status: TaskStatus }[]
  /** Primary next step (first missing). */
  next: string | null
  /** Extra hint after the learner is stuck (second missing or lesson.hints). */
  extraHint: string | null
  showStuckControl: boolean
  allTasksDone: boolean
  goalMet: boolean
}

function taskLooksDone(
  task: string,
  lesson: Lesson,
  code: string,
  progress: GoalProgress,
  status: ExecutionStatus,
  events: ResultEvent[],
): boolean {
  if (progress.met) return true

  const t = task.toLowerCase()
  const hasBlank = code.includes(BLANK)
  const prints = events.filter((e) => e.kind === 'print')
  const success = status === 'success'

  // Fill-in tasks
  if (
    t.includes('???') ||
    t.includes('replace') ||
    t.includes('fill in') ||
    t.includes('put your') ||
    t.includes('set name')
  ) {
    if (!hasBlank && code !== lesson.code) return true
  }

  // Run / check output
  if (t.includes('run') || t.includes('check the')) {
    if (success && prints.length > 0) return true
  }

  // Greeting / print something personal
  if (t.includes('greet') || t.includes('print')) {
    if (success && prints.some((p) => p.kind === 'print' && p.text.trim())) {
      // only mark done if starter was edited for print-edit tasks
      if (!hasBlank && (code !== lesson.code || !lesson.code.includes(BLANK))) {
        return true
      }
    }
  }

  return false
}

export function buildLessonProgress(
  lesson: Lesson,
  code: string,
  progress: GoalProgress,
  status: ExecutionStatus,
  events: ResultEvent[],
  opts: {
    stuckRevealed: boolean
    incompleteRunCount: number
  },
): LessonProgressView {
  const tasks = lesson.tasks.map((text, index) => ({
    text,
    instruction: lesson.taskInstructions?.[index] ?? null,
    status: taskLooksDone(text, lesson, code, progress, status, events)
      ? ('done' as const)
      : ('todo' as const),
  }))

  const allTasksDone = tasks.length > 0 && tasks.every((t) => t.status === 'done')
  const next = !progress.met && progress.missing[0] ? progress.missing[0] : null

  const lessonHints = (lesson as Lesson & { hints?: string[] }).hints ?? []
  const secondMissing = progress.missing[1] ?? lessonHints[0] ?? null

  const showStuckControl =
    !progress.met &&
    !opts.stuckRevealed &&
    secondMissing != null &&
    opts.incompleteRunCount >= 2

  const extraHint =
    !progress.met && opts.stuckRevealed && secondMissing
      ? secondMissing
      : null

  return {
    tasks,
    next,
    extraHint,
    showStuckControl,
    allTasksDone: allTasksDone || progress.met,
    goalMet: progress.met,
  }
}

/** True when a run finished but the goal still is not met. */
export function isIncompleteAttempt(
  status: ExecutionStatus,
  progress: GoalProgress,
): boolean {
  if (progress.met) return false
  return (
    status === 'success' ||
    status === 'error' ||
    status === 'timeout' ||
    status === 'stopped'
  )
}
