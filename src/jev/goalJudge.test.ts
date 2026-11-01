import { describe, expect, it, vi } from 'vitest'
import { askJevGoal, buildGoalRequest, changedStarterLines, MET_CONFIDENCE, parseGoalAnswer, VERDICTS, type GoalRun } from './goalJudge'
import { JEV_ROUTE } from './forward'

const run: GoalRun = {
  lessonGoal: 'Make Python show two messages that you chose yourself.',
  requirements: [
    { id: 'task1', text: 'Change the first print so it greets you by name' },
    { id: 'goal', text: 'Make Python show two messages that you chose yourself.' },
  ],
  code: 'token = "sk-live-abcdefghijklmnopqrstuvwx"\nprint("Hello, world!")',
  starterCode: 'print("Hello, world!")\nprint(???)',
  output: ['Hello, world!'],
}
const answer = (task1: string, goal: string, confidence = 0.9) => ({ answers: {
  task1: { type: 'choice', choice: task1, confidence }, goal: { type: 'choice', choice: goal, confidence } } })

describe('Jev goal judge', () => {
  it('asks one verdict question per requirement and never sends secrets', () => {
    const request = buildGoalRequest(run)
    expect(Object.keys(request.questions)).toEqual(['task1', 'goal'])
    expect(request.questions.task1.criteria).toBe(VERDICTS)
    expect(request.questions.task1.instructions).toContain('greets you by name')
    expect(JSON.stringify(request)).not.toContain('sk-live')
    expect(request.state.printed).toBe('Hello, world!')
  })

  it('turns green only on a confident met', () => {
    expect(parseGoalAnswer(answer('met', 'unchanged'), run.requirements)).toEqual([
      { id: 'task1', verdict: 'met', confidence: 0.9, met: true },
      { id: 'goal', verdict: 'unchanged', confidence: 0.9, met: false },
    ])
    expect(parseGoalAnswer(answer('met', 'met', MET_CONFIDENCE - 0.01), run.requirements)?.every((entry) => !entry.met)).toBe(true)
  })

  it('rejects answers with unknown or missing verdicts', () => {
    expect(parseGoalAnswer(answer('toString', 'met'), run.requirements)).toBeNull()
    expect(parseGoalAnswer({ answers: { task1: { type: 'choice', choice: 'met', confidence: 1 } } }, run.requirements)).toBeNull()
    expect(parseGoalAnswer(null, run.requirements)).toBeNull()
  })

  it('posts to the same-origin route and reports failures without throwing', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(answer('unchanged', 'missing'))))
    const result = await askJevGoal(run, { fetchImpl })
    expect(fetchImpl.mock.calls[0][0]).toBe(JEV_ROUTE)
    expect(result).toMatchObject({ ok: true, judgements: [{ id: 'task1', met: false }, { id: 'goal', met: false }] })
    const failed = await askJevGoal(run, {
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: 'Jev is not configured.' }), { status: 503 })),
    })
    expect(failed).toMatchObject({ ok: false, error: 'Jev is not configured.' })
  })

  it('names starter lines the learner changed, and sends Jev the same diff', () => {
    const starter = '# note\nscore = ???\nif score >= 90:\n    print("Excellent")'
    const code = 'score = 90\nscore2 = 71\nif score >= 70:\n    print("Excellent")'
    expect(changedStarterLines(starter, code)).toEqual([{ before: 'if score >= 90:', after: 'if score >= 70:' }])
    expect(changedStarterLines(starter, 'score = 95\nif score >= 90:\n    print("Excellent")')).toEqual([])
    const request = buildGoalRequest({ ...run, starterCode: starter, code })
    expect(request.state.changedFromStarter).toContain('- if score >= 90:')
    expect(request.state.changedFromStarter).toContain('+ if score >= 70:')
  })
})
