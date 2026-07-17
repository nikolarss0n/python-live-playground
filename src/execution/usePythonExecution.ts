import { useCallback, useEffect, useRef, useState } from 'react'
import { PythonRunner, type RunnerSnapshot } from './PythonRunner'
import { DEFAULT_DEBOUNCE_MS, DEFAULT_TIMEOUT_MS } from './protocol'

export type UsePythonExecutionOptions = {
  debounceMs?: number
  timeoutMs?: number
  autoRun?: boolean
}

const INITIAL: RunnerSnapshot = {
  status: 'booting',
  events: [],
  durationMs: null,
  runId: null,
  error: null,
}

export function usePythonExecution(
  code: string,
  options: UsePythonExecutionOptions = {},
) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    autoRun = true,
  } = options

  const runnerRef = useRef<PythonRunner | null>(null)
  const [snapshot, setSnapshot] = useState<RunnerSnapshot>(INITIAL)
  const latestCode = useRef(code)
  latestCode.current = code

  useEffect(() => {
    const runner = new PythonRunner(timeoutMs)
    runnerRef.current = runner
    const unsub = runner.subscribe(setSnapshot)
    void runner.start()
    return () => {
      unsub()
      runner.dispose()
      runnerRef.current = null
    }
  }, [timeoutMs])

  const runNow = useCallback(async (source?: string) => {
    const runner = runnerRef.current
    if (!runner) return
    await runner.run(source ?? latestCode.current)
  }, [])

  const stop = useCallback(() => {
    runnerRef.current?.stop()
  }, [])

  const booting = snapshot.status === 'booting'

  useEffect(() => {
    if (!autoRun) return
    if (booting) return

    const handle = window.setTimeout(() => {
      void runNow(code)
    }, debounceMs)

    return () => {
      window.clearTimeout(handle)
    }
  }, [code, autoRun, debounceMs, runNow, booting])

  return {
    snapshot,
    runNow,
    stop,
    isBooting: snapshot.status === 'booting',
    isRunning: snapshot.status === 'running',
  }
}
