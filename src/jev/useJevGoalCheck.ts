import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lesson } from '../examples'
import type { ResultEvent } from '../execution/protocol'
import { collectExprs, collectPrints } from '../goalCheck'
import type { TaskEvidence } from '../taskEvidence'
import { askJevGoal, changedStarterLines, VERDICT_TEXT, type GoalRequirement, type Judgement } from './goalJudge'
import { jevAvailable } from './pinpoint'

export type GoalCheckStatus = 'pass' | 'fail' | 'checking'
export type GoalCheckRow = { id: string; label: string; status: GoalCheckStatus; note: string | null; isGoal: boolean }
export type GoalChecks = { rows: GoalCheckRow[]; source: 'Jev' | 'local'; passed: number; refreshing?: boolean }

type Options = {
  lesson: Lesson
  code: string
  /** The latest run finished without an error and ran exactly this code. */
  freshSuccess: boolean
  events: readonly ResultEvent[]
  localTasksDone: readonly boolean[]
  localGoalMet: boolean
  /** Per-task evidence from the local checks, used for concrete reasons. */
  localEvidence?: readonly TaskEvidence[] | null
  enabled: boolean
  /** Bumped when the learner restarts the lesson, so checks passed before the restart no longer count. */
  attempt?: number
}

type Answer = { key: string; judgements: Judgement[] | null }

/** Why a row failed, naming the changed starter line when Jev doubts a run whose output looks right. */
function failNote(judgement: Judgement, starter: string, code: string): string {
  if (judgement.verdict !== 'met' && judgement.verdict !== 'changed_other') return VERDICT_TEXT[judgement.verdict]
  const change = changedStarterLines(starter, code)[0]
  if (change) {
    return change.after
      ? `The output looks right, but \`${change.before}\` was changed to \`${change.after}\`. Put it back and change only what this step names.`
      : `The output looks right, but \`${change.before}\` was removed. Put it back and change only what this step names.`
  }
  return judgement.verdict === 'changed_other' ? VERDICT_TEXT.changed_other : 'Not clearly done yet.'
}

const localReason = (evidence: TaskEvidence | undefined) =>
  evidence && !evidence.done ? evidence.summary.replace(/^Current task did not advance:\s*/, '') : null

/**
 * Judges each lesson task and the goal after a clean run: Jev decides met or not when available, the local checks
 * otherwise. The goal also needs the local goal check. A check passed once in this lesson stays passed.
 */
export function useJevGoalCheck({ lesson, code, freshSuccess, events, localTasksDone, localGoalMet, localEvidence, enabled, attempt = 0 }: Options): GoalChecks | null {
  const [ready, setReady] = useState<boolean | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const cache = useRef(new Map<string, Judgement[]>())
  const passedBefore = useRef(new Map<string, Set<string>>())
  const scope = `${lesson.id}\u0000${attempt}`

  useEffect(() => {
    let live = true
    void jevAvailable().then((available) => { if (live) setReady(available) })
    return () => { live = false }
  }, [])

  const output = useMemo(() => [...collectPrints([...events]), ...collectExprs([...events])].filter((line) => line.trim()), [events])
  const requirements = useMemo<GoalRequirement[]>(() => [
    ...lesson.tasks.map((text, index) => ({ id: `task${index + 1}`, text, detail: lesson.taskInstructions?.[index] ?? null })),
    { id: 'goal', text: lesson.goal },
  ], [lesson])
  const active = enabled && freshSuccess && lesson.tasks.length > 0
  const key = `${lesson.id}\u0000${code}\u0000${output.join('\n')}`
  const asking = active && ready === true

  useEffect(() => {
    if (!asking) return
    const cached = cache.current.get(key)
    if (cached) { setAnswer({ key, judgements: cached }); return }
    const abort = new AbortController()
    void askJevGoal({ lessonGoal: lesson.goal, requirements, code, starterCode: lesson.code, output }, { signal: abort.signal }).then((result) => {
      if (abort.signal.aborted) return
      if (result.ok) cache.current.set(key, result.judgements)
      setAnswer({ key, judgements: result.ok ? result.judgements : null })
    })
    return () => abort.abort()
  }, [asking, key, lesson, requirements, code, output])

  const checks = useMemo<GoalChecks | null>(() => {
    if (!active) return null
    const judged = asking && answer?.key === key ? answer.judgements : undefined
    const pending = (asking && judged === undefined) || ready === null
    const byId = new Map((judged ?? []).map((entry) => [entry.id, entry]))
    // Trust a passing local check over a doubtful Jev: low confidence, or "changed other code" when no starter line changed.
    const doubtful = (judgement: Judgement) =>
      judgement.verdict === 'met' || (judgement.verdict === 'changed_other' && changedStarterLines(lesson.code, code).length === 0)
    const tasks: GoalCheckRow[] = lesson.tasks.map((text, index) => {
      const id = `task${index + 1}`
      const judgement = byId.get(id)
      const local = localTasksDone[index] ?? false
      const reason = localReason(localEvidence?.[index])
      if (pending) return { id, label: text, status: 'checking', note: null, isGoal: false }
      if (!judgement) return { id, label: text, status: local ? 'pass' : 'fail', note: local ? null : reason, isGoal: false }
      if (judgement.met || (local && doubtful(judgement))) return { id, label: text, status: 'pass', note: null, isGoal: false }
      return { id, label: text, status: 'fail', note: reason ?? failNote(judgement, lesson.code, code), isGoal: false }
    })
    const goalJudgement = byId.get('goal')
    const tasksPass = tasks.every((row) => row.status === 'pass')
    const goalPass = localGoalMet && (!goalJudgement || goalJudgement.met || (tasksPass && doubtful(goalJudgement)))
    const goal: GoalCheckRow = {
      id: 'goal',
      label: lesson.goal,
      status: pending ? 'checking' : goalPass ? 'pass' : 'fail',
      note: pending || goalPass ? null
        : goalJudgement ? failNote(goalJudgement, lesson.code, code) : 'Not clearly done yet.',
      isGoal: true,
    }
    // A check passed in an earlier run of this lesson stays passed: "then try …" steps undo the step before them.
    const earlier = passedBefore.current.get(scope) ?? new Set<string>()
    const rows = [...tasks, goal].map((row): GoalCheckRow => row.status === 'fail' && earlier.has(row.id)
      ? { ...row, status: 'pass', note: 'Passed in an earlier run.' }
      : row)
    return { rows, source: judged ? 'Jev' : 'local', passed: rows.filter((row) => row.status === 'pass').length }
  }, [active, asking, ready, answer, key, lesson, code, localTasksDone, localEvidence, localGoalMet, scope])

  // While Jev re-checks a new run, keep the last verdicts instead of flashing every row to a spinner.
  const last = useRef<{ scope: string; checks: GoalChecks } | null>(null)
  const pending = checks?.rows.some((row) => row.status === 'checking') ?? false
  if (checks && !pending) {
    last.current = { scope, checks }
    const passed = passedBefore.current.get(scope) ?? new Set<string>()
    for (const row of checks.rows) if (row.status === 'pass') passed.add(row.id)
    passedBefore.current.set(scope, passed)
  }
  if (checks && pending && last.current?.scope === scope) return { ...last.current.checks, refreshing: true }
  return checks
}
