import { isRefresherDayId } from './refresher/types'
import type { Lesson } from './examples'
import type { GoalProgress } from './goalCheck'
import type { LessonProgressView } from './lessonProgress'
import type { RunnerSnapshot } from './execution/PythonRunner'
import { isExerciseId, EXERCISE_CHECKS } from './serviceExercise'

export function evaluateServiceProgress(
  lesson: Lesson,
  code: string,
  snapshot: RunnerSnapshot,
  hintRevealed = false,
): { goal: GoalProgress; view: LessonProgressView; evidence: string } | null {
  if (!isExerciseId(lesson.id) || isRefresherDayId(lesson.id)) return null
  const expected = EXERCISE_CHECKS[lesson.id]
  const fresh = snapshot.executedCode === code && snapshot.exerciseId === lesson.id
  const checked = fresh && snapshot.status === 'success'
  const checks = checked ? snapshot.checks ?? [] : []
  const tasks = expected.map((definition, index) => {
    const matches = checks.filter((check) => check.id === definition.id)
    const check = matches.length === 1 ? matches[0] : undefined
    return {
      text: lesson.tasks[index] ?? definition.label,
      instruction: check && !check.passed ? check.detail : lesson.taskInstructions?.[index] ?? null,
      status: check?.passed ? 'done' as const : 'todo' as const,
    }
  })
  const complete = tasks.filter((task) => task.status === 'done').length
  const met = checked && complete === expected.length && checks.length === expected.length
  const nextTask = tasks.find((task) => task.status === 'todo')
  const missing = met ? [] : [
    fresh && ['error', 'timeout'].includes(snapshot.status)
      ? 'Fix the execution error so the behavior checks can run.'
      : nextTask?.instruction ?? 'Run your current code to check its behavior.',
  ]
  return {
    goal: { met, missing },
    view: {
      tasks,
      next: missing[0] ?? null,
      extraHint: hintRevealed ? lesson.hints?.[0] ?? null : null,
      showStuckControl: !met && !hintRevealed && Boolean(lesson.hints?.length),
      allTasksDone: met,
      goalMet: met,
    },
    evidence: checked
      ? `${complete}/${expected.length} behavior checks passed. ${met
        ? lesson.id === 'service-tests'
          ? 'Your service and request tests work. That completes Build AI services.'
          : lesson.difficulty === 'genai' ? 'Exercise complete. This records practice, not production experience.'
            : 'Continue with Next to build on this code.'
        : missing[0]}`
      : fresh && snapshot.status === 'error'
        ? 'Behavior checks are waiting for your code to run successfully.'
        : 'Behavior checks run automatically with your code.',
  }
}
