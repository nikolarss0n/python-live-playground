import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { LESSONS } from '../examples'
import type { ResultEvent } from '../execution/protocol'
import { GoalChecks } from '../components/GoalChecks'
import { useJevGoalCheck } from './useJevGoalCheck'

const lesson = LESSONS.find((entry) => entry.id === 'printing')!
const code = 'print("Hello, world!")\nprint("I am master")\n'
const events: ResultEvent[] = [
  { kind: 'print', text: 'Hello, world!', line: 1 },
  { kind: 'print', text: 'I am master', line: 2 },
] as ResultEvent[]

function mockJev(answers: Record<string, string> | null, confidence = 0.9) {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method) return new Response(JSON.stringify({ configured: answers !== null }))
    return new Response(JSON.stringify({ answers: Object.fromEntries(Object.entries(answers ?? {})
      .map(([id, choice]) => [id, { type: 'choice', choice, confidence }])) }))
  }))
}

const options = (overrides: Partial<Parameters<typeof useJevGoalCheck>[0]> = {}) => ({
  lesson, code, freshSuccess: true, events, localTasksDone: [true, true], localGoalMet: true, enabled: true, ...overrides,
})

afterEach(() => vi.unstubAllGlobals())

describe('useJevGoalCheck', () => {
  it('shows Jev verdicts per task and judges the goal on its own', async () => {
    mockJev({ task1: 'unchanged', task2: 'met', goal: 'met' })
    const { result } = renderHook(() => useJevGoalCheck(options()))
    await waitFor(() => expect(result.current?.source).toBe('Jev'))
    expect(result.current?.rows.map((row) => [row.id, row.status])).toEqual([['task1', 'fail'], ['task2', 'pass'], ['goal', 'pass']])
    expect(result.current?.rows[0].note).toMatch(/starter code/)
    expect(result.current?.passed).toBe(2)
  })

  it('trusts passing local checks over a low-confidence Jev "met"', async () => {
    mockJev({ task1: 'met', task2: 'met', goal: 'met' }, 0.2)
    const { result } = renderHook(() => useJevGoalCheck(options()))
    await waitFor(() => expect(result.current?.source).toBe('Jev'))
    expect(result.current?.rows.map((row) => row.status)).toEqual(['pass', 'pass', 'pass'])
  })

  it('ignores "changed other code" when no starter line changed, but not for a failing task', async () => {
    const filled = lesson.code.replaceAll('???', '"Ada"')
    mockJev({ task1: 'changed_other', task2: 'met', goal: 'changed_other' })
    const { result } = renderHook(() => useJevGoalCheck(options({ code: filled })))
    await waitFor(() => expect(result.current?.source).toBe('Jev'))
    expect(result.current?.rows.map((row) => row.status)).toEqual(['pass', 'pass', 'pass'])

    mockJev({ task1: 'unchanged', task2: 'met', goal: 'met' }, 0.2)
    const second = renderHook(() => useJevGoalCheck(options({ code: filled + '\n' })))
    await waitFor(() => expect(second.result.current?.source).toBe('Jev'))
    expect(second.result.current?.rows.map((row) => row.status)).toEqual(['fail', 'pass', 'fail'])
  })

  it('keeps a check passed in an earlier run of the lesson', async () => {
    mockJev({ task1: 'met', task2: 'missing', goal: 'met' })
    const { result, rerender } = renderHook((props) => useJevGoalCheck(props), { initialProps: options() })
    await waitFor(() => expect(result.current?.rows[0].status).toBe('pass'))
    mockJev({ task1: 'wrong_output', task2: 'met', goal: 'wrong_output' })
    rerender(options({ code: 'print("Excellent")\n', localGoalMet: false }))
    await waitFor(() => expect(result.current?.rows[1].status).toBe('pass'))
    expect(result.current?.rows.map((row) => row.status)).toEqual(['pass', 'pass', 'pass'])
    expect(result.current?.rows[0].note).toBe('Passed in an earlier run.')
  })

  it('turns every row green when Jev and the local goal check agree', async () => {
    mockJev({ task1: 'met', task2: 'met', goal: 'met' })
    const { result } = renderHook(() => useJevGoalCheck(options()))
    await waitFor(() => expect(result.current?.passed).toBe(3))
  })

  it('falls back to the local checks without Jev and stays hidden before a clean run', async () => {
    mockJev(null)
    const { result, rerender } = renderHook((props) => useJevGoalCheck(props), { initialProps: options({ localTasksDone: [false, true], localGoalMet: false }) })
    await waitFor(() => expect(result.current?.rows.map((row) => row.status)).toEqual(['fail', 'pass', 'fail']))
    expect(result.current?.source).toBe('local')
    rerender(options({ freshSuccess: false }))
    expect(result.current).toBeNull()
  })

  it('renders green checks with accessible state text', () => {
    render(<GoalChecks checks={{ source: 'Jev', passed: 3, rows: [
      { id: 'task1', label: 'Greet by name', status: 'pass', note: null, isGoal: false },
      { id: 'task2', label: 'Second print', status: 'pass', note: null, isGoal: false },
      { id: 'goal', label: 'Two messages', status: 'pass', note: null, isGoal: true },
    ] }} />)
    expect(screen.getByRole('region', { name: 'Goal checks' })).toHaveTextContent('Goal complete')
    expect(screen.getByText('3/3 passed · Jev')).toBeInTheDocument()
    expect(screen.getAllByText('Passed:')).toHaveLength(3)
  })
})

describe('useJevGoalCheck re-runs', () => {
  it('keeps the previous verdicts while Jev re-checks a new run', async () => {
    let release: (() => void) | null = null
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) return new Response(JSON.stringify({ configured: true }))
      const body = JSON.parse(String(init.body)) as { state: { code: string } }
      if (body.state.code.includes('second')) await new Promise<void>((resolve) => { release = resolve })
      return new Response(JSON.stringify({ answers: Object.fromEntries(['task1', 'task2', 'goal']
        .map((id) => [id, { type: 'choice', choice: 'met', confidence: 0.9 }])) }))
    }))
    const { result, rerender } = renderHook((props) => useJevGoalCheck(props), { initialProps: options() })
    await waitFor(() => expect(result.current?.passed).toBe(3))
    rerender(options({ code: `${code}print("second")\n` }))
    expect(result.current?.refreshing).toBe(true)
    expect(result.current?.rows.every((row) => row.status === 'pass')).toBe(true)
    await waitFor(() => expect(release).not.toBeNull())
    release!()
    await waitFor(() => expect(result.current?.refreshing).toBeUndefined())
  })
})

describe('useJevGoalCheck reasons', () => {
  it('names the changed starter line when the output looks right but other code changed', async () => {
    mockJev({ task1: 'changed_other', task2: 'met', goal: 'met' })
    const changed = lesson.code.replace('Hello, world!', 'Hi')
    const { result } = renderHook(() => useJevGoalCheck(options({ code: changed, localEvidence: null })))
    await waitFor(() => expect(result.current?.source).toBe('Jev'))
    expect(result.current?.rows[0].note).toBe('The output looks right, but `print("Hello, world!")` was changed to `print("Hi")`. Put it back and change only what this step names.')
  })
})
