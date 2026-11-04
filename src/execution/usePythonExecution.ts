import { useCallback, useEffect, useRef, useState } from 'react'
import { PythonRunner, type RunnerSnapshot } from './PythonRunner'
import type { ExerciseId } from '../serviceExercise'
import {
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_TIMEOUT_MS,
  type InvokeRequest,
  type RunCheckOptions,
} from './protocol'

export type UsePythonExecutionOptions = {
  debounceMs?: number
  timeoutMs?: number
  autoRun?: boolean
  exerciseId?: ExerciseId
  checkOptions?: RunCheckOptions
  /** Editor code that came from someone else; running it taints the worker so the next other run starts fresh. */
  untrustedCode?: string | null
}

const INITIAL: RunnerSnapshot = {
  status: 'booting',
  events: [],
  durationMs: null,
  runId: null,
  error: null,
  executedCode: null,
  routes: [],
}

export function usePythonExecution(
  code: string,
  options: UsePythonExecutionOptions = {},
) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    autoRun = true,
    exerciseId,
    checkOptions,
    untrustedCode = null,
  } = options
  const untrustedRef = useRef(untrustedCode)
  untrustedRef.current = untrustedCode

  const runnerRef = useRef<PythonRunner | null>(null)
  const hasBeenReady = useRef(false)
  const [snapshot, setSnapshot] = useState<RunnerSnapshot>(INITIAL)
  const checkSignature = JSON.stringify(checkOptions ?? null)
  const inputRef = useRef({ code, exerciseId, checkOptions, checkSignature, revision: 0 })
  if (inputRef.current.code !== code || inputRef.current.exerciseId !== exerciseId || inputRef.current.checkSignature !== checkSignature) {
    inputRef.current = { code, exerciseId, checkOptions, checkSignature, revision: inputRef.current.revision + 1 }
  }
  const consumedRevision = useRef(-1)
  const debounceHandle = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const clearDebounce = useCallback(() => {
    if (debounceHandle.current !== null) {
      window.clearTimeout(debounceHandle.current)
      debounceHandle.current = null
    }
  }, [])

  useEffect(() => {
    const runner = new PythonRunner(timeoutMs)
    runnerRef.current = runner
    consumedRevision.current = -1
    hasBeenReady.current = false
    const unsub = runner.subscribe((next) => {
      if (next.status === 'ready') hasBeenReady.current = true
      setSnapshot(next)
    })
    void runner.start()
    return () => {
      clearDebounce()
      unsub()
      runner.dispose()
      runnerRef.current = null
    }
  }, [timeoutMs, clearDebounce])

  const runNow = useCallback(async (source?: string) => {
    clearDebounce()
    const input = inputRef.current
    consumedRevision.current = input.revision
    const runner = runnerRef.current
    if (!runner) return
    const untrusted = untrustedRef.current !== null && input.code === untrustedRef.current
    if (untrusted) await runner.run(source ?? input.code, input.exerciseId, input.checkOptions ?? {}, true)
    else if (input.checkOptions) await runner.run(source ?? input.code, input.exerciseId, input.checkOptions)
    else await runner.run(source ?? input.code, input.exerciseId)
  }, [clearDebounce])

  const stop = useCallback(() => {
    clearDebounce()
    consumedRevision.current = inputRef.current.revision
    runnerRef.current?.stop()
  }, [clearDebounce])

  const invoke = useCallback(async (request: InvokeRequest) => {
    const runner = runnerRef.current
    if (!runner) return
    await runner.invoke(request)
  }, [])

  const booting = snapshot.status === 'booting'

  useEffect(() => {
    if (!autoRun) return
    if (booting || !hasBeenReady.current) return
    const revision = inputRef.current.revision
    if (consumedRevision.current === revision) return

    debounceHandle.current = window.setTimeout(() => {
      if (inputRef.current.revision !== revision || consumedRevision.current === revision) return
      void runNow()
    }, debounceMs)

    return clearDebounce
  }, [code, exerciseId, checkSignature, autoRun, debounceMs, runNow, booting, timeoutMs, clearDebounce])

  return {
    snapshot,
    runNow,
    stop,
    invoke,
    isBooting: snapshot.status === 'booting',
    isRunning: snapshot.status === 'running',
  }
}
