import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getLesson, lessonsForSection } from '../examples'
import { BLANK, evaluateGoal } from '../goalCheck'
import { PYTHON_PRELUDE } from '../execution/instrument'
import type { ResultEvent } from '../execution/protocol'
import { BLANK_ANSWERS } from './blankAnswers'
import { HARNESS_LADDERS } from './harnessLadders'
import { HARNESS_LESSON_DRAFTS } from './harnessInterviewLessons'

const hasPython = spawnSync('python3', ['--version']).status === 0

/** Runs through the playground's own runner, so top-level await behaves as in the browser. */
function run(source: string): { ok: boolean; events: ResultEvent[] } {
  const script = `import asyncio, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
request = json.loads(sys.stdin.read())
exec(request["prelude"], globals())
print(json.dumps(asyncio.run(_plp_run_async(request["source"])), default=str))
`
  const output = execFileSync('python3', ['-c', script], { input: JSON.stringify({ source, prelude: PYTHON_PRELUDE }), encoding: 'utf8', timeout: 15_000 })
  return JSON.parse(output.trim().split('\n').at(-1) ?? '{}') as { ok: boolean; events: ResultEvent[] }
}
function fill(code: string, answers: readonly string[]): string {
  let index = 0
  return code.replace(/\?\?\?/g, () => answers[index++] ?? BLANK)
}

describe.skipIf(!hasPython)('agent harness interview lessons in the playground runner', () => {
  it.each(HARNESS_LESSON_DRAFTS.map((draft) => [draft.id] as const))('%s: the starter fails and the intended fill meets the goal', (id) => {
    const lesson = getLesson(id)
    const answers = BLANK_ANSWERS[id]
    expect(answers, id).toBeDefined()
    expect(lesson.code.split(BLANK).length - 1, id).toBe(answers.length)
    expect(run(lesson.code).ok, `${id} starter should not run`).toBe(false)

    const solved = fill(lesson.code, answers)
    const { ok, events } = run(solved)
    const printed = events.map((event) => (event.kind === 'print' ? event.text : event.kind === 'error' ? `ERROR ${event.message}` : '')).join('\n')
    expect(ok, `${id} solution failed:\n${printed}`).toBe(true)
    const progress = evaluateGoal(lesson, { code: solved, starterCode: lesson.code, events, status: 'success', executedCode: solved })
    expect(progress.missing, `${id}:\n${printed}`).toEqual([])
    expect(progress.met, id).toBe(true)
  })
})

describe('agent harness interview section', () => {
  it('has thirteen lessons in four chapters, each with a hint ladder', () => {
    const lessons = lessonsForSection('harness')
    expect(lessons.map((lesson) => lesson.id)).toEqual(HARNESS_LESSON_DRAFTS.map((draft) => draft.id))
    expect([...new Set(lessons.map((lesson) => lesson.chapter))]).toEqual(['Agent loop', 'Production controls', 'Evals & observability', 'Mock interview'])
    for (const lesson of lessons) expect(HARNESS_LADDERS[lesson.id], lesson.id).toBeDefined()
  })
})
