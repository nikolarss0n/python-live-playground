import type { Lesson, GoalProgress } from './examples'
import { evaluateGoal } from './goalCheck'
import type { ExecutionStatus, ResultEvent } from './execution/protocol'

export function printsFromEvents(events: ResultEvent[]): string {
  return events
    .filter((e): e is Extract<ResultEvent, { kind: 'print' }> => e.kind === 'print')
    .map((e) => e.text)
    .join('\n')
}

export function evaluateLessonGoal(
  lesson: Lesson,
  code: string,
  events: ResultEvent[],
  status: ExecutionStatus,
  executedCode: string | null = null,
): GoalProgress {
  return evaluateGoal(lesson, {
    code,
    starterCode: lesson.code,
    status,
    events,
    executedCode,
  })
}
