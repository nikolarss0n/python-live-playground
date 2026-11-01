import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseId } from '../serviceExercise'
import type { RunnerSnapshot } from './PythonRunner'
import type { InvokeRequest } from './protocol'
import { usePythonExecution } from './usePythonExecution'

const { MockRunner } = vi.hoisted(() => {
  class MockRunner {
    static instances: MockRunner[] = []
    listeners = new Set<(snapshot: RunnerSnapshot) => void>()
    snapshot: RunnerSnapshot = {
      status: 'booting', events: [], durationMs: null, runId: null,
      error: null, executedCode: null, routes: [],
    }
    run = vi.fn(async (_code: string, _exerciseId?: ExerciseId) => {})
    stop = vi.fn(() => {})
    invoke = vi.fn(async (_request: InvokeRequest) => {})
    dispose = vi.fn(() => {})
    start = vi.fn(async () => {})
    constructor() { MockRunner.instances.push(this) }
    subscribe(listener: (snapshot: RunnerSnapshot) => void) {
      this.listeners.add(listener)
      listener(this.snapshot)
      return () => { this.listeners.delete(listener) }
    }
    emit(update: Partial<RunnerSnapshot>) {
      this.snapshot = { ...this.snapshot, ...update }
      for (const listener of this.listeners) listener(this.snapshot)
    }
  }
  return { MockRunner }
})

vi.mock('./PythonRunner', () => ({ PythonRunner: MockRunner }))

function runner() {
  const instance = MockRunner.instances.at(-1)
  if (!instance) throw new Error('Expected a runner instance')
  return instance
}

async function advance(milliseconds = 500) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) })
}

describe('usePythonExecution scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockRunner.instances = []
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('runs initial input once after ready and debounces actual edits', async () => {
    const { rerender } = renderHook(({ code }) => usePythonExecution(code), { initialProps: { code: 'print(1)' } })
    await advance()
    expect(runner().run).not.toHaveBeenCalled()
    act(() => runner().emit({ status: 'ready' }))
    await advance(449)
    expect(runner().run).not.toHaveBeenCalled()
    await advance(1)
    expect(runner().run).toHaveBeenCalledExactlyOnceWith('print(1)', undefined)
    rerender({ code: 'print(2)' })
    await advance(200)
    rerender({ code: 'print(3)' })
    await advance()
    expect(runner().run.mock.calls).toEqual([['print(1)', undefined], ['print(3)', undefined]])
  })

  it('manual Run cancels the pending automatic run', async () => {
    const { result } = renderHook(() => usePythonExecution('long_running()', { exerciseId: 'genai-async' }))
    act(() => runner().emit({ status: 'ready' }))
    await advance(200)
    await act(async () => { await result.current.runNow() })
    act(() => runner().emit({ status: 'running' }))
    await advance(5000)
    expect(runner().run).toHaveBeenCalledExactlyOnceWith('long_running()', 'genai-async')
  })

  it('does not turn an initial runtime load failure into an automatic retry', async () => {
    const { result } = renderHook(() => usePythonExecution('first()'))
    act(() => runner().emit({ status: 'error', error: 'Python failed to load' }))
    await advance(5000)
    expect(runner().run).not.toHaveBeenCalled()
    await act(async () => { await result.current.runNow() })
    expect(runner().run).toHaveBeenCalledExactlyOnceWith('first()', undefined)
  })

  it('worker replacement does not resubmit already consumed input', async () => {
    const { result } = renderHook(() => usePythonExecution('long_running()'))
    act(() => runner().emit({ status: 'ready' }))
    await act(async () => { await result.current.runNow() })
    for (const status of ['booting', 'ready', 'running', 'timeout', 'booting', 'ready'] as const) {
      act(() => runner().emit({ status }))
      await advance()
    }
    expect(runner().run).toHaveBeenCalledTimes(1)
  })

  it('runs only the latest source and exercise after edits during boot', async () => {
    const initialProps: { code: string; exerciseId: ExerciseId } = { code: 'first()', exerciseId: 'service-validation' }
    const { rerender } = renderHook(({ code, exerciseId }) => usePythonExecution(code, { exerciseId }), { initialProps })
    rerender({ code: 'second()', exerciseId: 'service-validation' })
    rerender({ code: 'latest()', exerciseId: 'service-endpoint' })
    await advance()
    expect(runner().run).not.toHaveBeenCalled()
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    expect(runner().run).toHaveBeenCalledExactlyOnceWith('latest()', 'service-endpoint')
  })

  it('preserves a new edit while a submitted run replaces its worker', async () => {
    const { result, rerender } = renderHook(({ code }) => usePythonExecution(code), { initialProps: { code: 'first()' } })
    act(() => runner().emit({ status: 'ready' }))
    await act(async () => { await result.current.runNow() })
    act(() => runner().emit({ status: 'booting' }))
    rerender({ code: 'second()' })
    rerender({ code: 'latest()' })
    await advance()
    expect(runner().run).toHaveBeenCalledTimes(1)
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    expect(runner().run.mock.calls).toEqual([['first()', undefined], ['latest()', undefined]])
  })

  it('automatically checks a different exercise even when its source is identical', async () => {
    const initialProps: { exerciseId: ExerciseId } = { exerciseId: 'service-validation' }
    const { rerender } = renderHook(({ exerciseId }) => usePythonExecution('same_source()', { exerciseId }), { initialProps })
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    rerender({ exerciseId: 'service-endpoint' })
    await advance()
    expect(runner().run.mock.calls).toEqual([
      ['same_source()', 'service-validation'], ['same_source()', 'service-endpoint'],
    ])
  })

  it('Stop consumes pending work, including while booting, until another edit', async () => {
    const { result, rerender } = renderHook(({ code }) => usePythonExecution(code), { initialProps: { code: 'first()' } })
    act(() => result.current.stop())
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    expect(runner().run).not.toHaveBeenCalled()
    rerender({ code: 'second()' })
    await advance(100)
    act(() => result.current.stop())
    act(() => runner().emit({ status: 'booting' }))
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    expect(runner().run).not.toHaveBeenCalled()
    rerender({ code: 'third()' })
    await advance()
    expect(runner().run).toHaveBeenCalledExactlyOnceWith('third()', undefined)
    expect(runner().stop).toHaveBeenCalledTimes(2)
  })

  it('an edit back to the last submitted source still creates fresh work', async () => {
    const { rerender } = renderHook(({ code }) => usePythonExecution(code), { initialProps: { code: 'first()' } })
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    rerender({ code: 'temporary()' })
    rerender({ code: 'first()' })
    await advance()
    expect(runner().run.mock.calls).toEqual([['first()', undefined], ['first()', undefined]])
  })

  it('manual calls use the latest exercise even through an earlier callback reference', async () => {
    const initialProps: { exerciseId: ExerciseId } = { exerciseId: 'service-validation' }
    const { result, rerender } = renderHook(({ exerciseId }) => usePythonExecution('same_source()', { exerciseId }), { initialProps })
    const runNow = result.current.runNow
    rerender({ exerciseId: 'service-endpoint' })
    await act(async () => { await runNow() })
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    expect(runner().run).toHaveBeenCalledExactlyOnceWith('same_source()', 'service-endpoint')
  })

  it('autoRun disabled and unmount both clear scheduled work', async () => {
    const { rerender, unmount } = renderHook(({ autoRun }) => usePythonExecution('first()', { autoRun }), { initialProps: { autoRun: true } })
    act(() => runner().emit({ status: 'ready' }))
    rerender({ autoRun: false })
    await advance()
    expect(runner().run).not.toHaveBeenCalled()
    rerender({ autoRun: true })
    await advance(100)
    unmount()
    await advance()
    expect(runner().run).not.toHaveBeenCalled()
    expect(runner().dispose).toHaveBeenCalledOnce()
  })

  it('runs unchanged code once when a changed timeout recreates the runner', async () => {
    const { rerender } = renderHook(({ timeoutMs }) => usePythonExecution('same_source()', { timeoutMs }), {
      initialProps: { timeoutMs: 3000 },
    })
    const original = runner()
    act(() => original.emit({ status: 'ready' }))
    await advance()
    rerender({ timeoutMs: 5000 })
    expect(original.dispose).toHaveBeenCalledOnce()
    act(() => runner().emit({ status: 'ready' }))
    await advance()
    expect(runner().run).toHaveBeenCalledExactlyOnceWith('same_source()', undefined)
  })
})
