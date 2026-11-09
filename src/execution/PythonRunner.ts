import { readWorkerMessage } from './workerMessages'
import type {
  DiscoveredRoute,
  ExecutionStatus,
  FullstackPayload,
  InvokeRequest,
  ResultEvent,
  WorkerInboundMessage,
  WorkerOutboundMessage,
  RunCheckOptions,
} from './protocol'
import { DEFAULT_TIMEOUT_MS } from './protocol'
import type { ExerciseCheck, ExerciseId } from '../serviceExercise'
import {
  enrichErrorEvent,
  explainError,
  lineFromSource,
} from './errorExplain'

/** Shown when the worker itself fails, so the learner knows it is not their code. */
const RUNNER_ERROR = 'RunnerError: Python stopped working in this tab.'

function makeErrorEvent(
  message: string,
  traceback: string,
  line?: number,
  sourceCode?: string,
): ResultEvent {
  const sourceLine = sourceCode
    ? lineFromSource(sourceCode, line)
    : undefined
  const explanation = explainError(message, undefined, { sourceLine })
  return enrichErrorEvent(
    {
      kind: 'error',
      message,
      friendly: `${explanation.name}: ${explanation.detail}\n\n${explanation.summary}\n\n${explanation.tip}`,
      traceback,
      line,
      explanation,
    },
    { sourceLine },
  )
}

function enrichEvents(
  events: ResultEvent[],
  sourceCode: string,
): ResultEvent[] {
  return events.map((e) => {
    if (e.kind !== 'error') return e
    const sourceLine = lineFromSource(sourceCode, e.line)
    const start = Math.max(0, (e.line ?? 1) - 1)
    const sourceSnippet = sourceCode.split(/\r?\n/).slice(start, start + 5).join('\n')
    return enrichErrorEvent(e, { sourceLine, sourceSnippet })
  })
}

export type RunnerSnapshot = {
  status: ExecutionStatus
  events: ResultEvent[]
  durationMs: number | null
  runId: string | null
  error: string | null
  /** Source that produced the current events (for goal checks). */
  executedCode: string | null
  /** Simulated FastAPI routes registered by the last editor run. */
  routes: DiscoveredRoute[]
  exerciseId?: ExerciseId
  contextKey?: string
  checks?: ExerciseCheck[]
  /** Database tables and route responses from the last full-stack run. */
  fullstack?: FullstackPayload
}

export type RunnerListener = (snapshot: RunnerSnapshot) => void

/**
 * Owns the Pyodide web worker lifecycle.
 * Stop / timeout terminate the worker and create a fresh one.
 */
export class PythonRunner {
  private worker: Worker | null = null
  private ready = false
  /** The current worker has run untrusted code. */
  private tainted = false
  /** True once the current worker failed to boot; it must be replaced, not awaited. */
  private initFailed = false
  private disposed = false
  /** Settled with true when the current worker is ready, false when it is replaced or fails. */
  private readyWaiters: Array<(ready: boolean) => void> = []
  /** Bumped by every run, clear, Stop and dispose; a run only proceeds while it holds the latest value. */
  private requestSeq = 0
  /** Sequence of a run still preparing its worker; blocks invoke from overlapping it. */
  private pendingSeq: number | null = null
  private listeners = new Set<RunnerListener>()
  private runCounter = 0
  private activeId: string | null = null
  private activeExerciseId: ExerciseId | undefined
  private activeContextKey: string | undefined
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private timeoutMs: number
  /** Last submitted source — used to teach from the failing line text. */
  private lastCode = ''
  /** Events from the last editor run (prints/errors), excluding Call results. */
  private lastRunEvents: ResultEvent[] = []
  /** Packages loaded into the current worker, and the pending load requests by id. */
  private loadedPackages = new Set<string>()
  private loadWaiters = new Map<string, { resolve: () => void; reject: (error: Error) => void }>()
  private snapshot: RunnerSnapshot = {
    status: 'booting',
    events: [],
    durationMs: null,
    runId: null,
    error: null,
    executedCode: null,
    routes: [],
  }

  constructor(timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): RunnerSnapshot {
    return this.snapshot
  }

  async start(): Promise<void> {
    this.spawnWorker()
    await this.waitUntilReady()
  }

  /**
   * `untrusted` marks code the learner did not write (a shared link). Python state survives between runs,
   * so the next trusted run gets a fresh worker instead of one that untrusted code may have altered.
   */
  async run(code: string, exerciseId?: ExerciseId, options: RunCheckOptions = {}, untrusted = false): Promise<void> {
    if (this.disposed) return
    const trimmed = code
    const seq = ++this.requestSeq
    this.pendingSeq = null
    if (!trimmed.trim()) {
      const wasRunning = this.activeId !== null || this.snapshot.status === 'running'
      this.clearTimeout()
      this.activeId = null
      this.activeExerciseId = undefined
      this.activeContextKey = undefined
      if (wasRunning) this.spawnWorker()
      this.lastCode = ''
      this.lastRunEvents = []
      this.setSnapshot({
        status: 'idle',
        events: [],
        durationMs: null,
        runId: null,
        error: null,
        executedCode: null,
        routes: [],
      })
      return
    }

    // If a previous run is still busy (e.g. infinite loop), the worker cannot
    // accept a new message — kill it first so we do not stack CPU burners.
    this.pendingSeq = seq
    const isCurrent = () => seq === this.requestSeq && !this.disposed
    if (this.activeId !== null || this.snapshot.status === 'running') {
      this.clearTimeout()
      this.activeId = null
      this.spawnWorker()
    } else if (!this.worker || this.initFailed || (this.tainted && !untrusted)) {
      this.spawnWorker()
    }
    // A worker that is still booting is reused rather than restarted.
    const ready = await this.waitUntilReady()
    if (!isCurrent()) return
    if (!ready) {
      this.pendingSeq = null
      return
    }

    if (options.fullstack) {
      await this.loadPackages(['sqlite3'])
      if (!isCurrent()) return
      if (!this.ready) {
        this.pendingSeq = null
        return
      }
    }
    this.pendingSeq = null

    this.runCounter += 1
    const id = `run-${this.runCounter}`
    this.activeId = id
    this.activeExerciseId = exerciseId
    this.activeContextKey = options.contextKey
    this.lastCode = trimmed
    this.clearTimeout()
    this.lastRunEvents = []
    // Keep the last results on screen until this run answers, so a re-run only changes what is new.
    this.setSnapshot({
      status: 'running',
      events: this.snapshot.events,
      durationMs: this.snapshot.durationMs,
      runId: id,
      error: null,
      executedCode: null,
      routes: [],
      ...(options.fullstack && this.snapshot.fullstack ? { fullstack: this.snapshot.fullstack } : {}),
    })

    this.timeoutHandle = setTimeout(() => {
      if (this.activeId === id) {
        this.handleTimeout(id)
      }
    }, this.timeoutMs)

    if (untrusted) this.tainted = true
    this.post({ type: 'run', id, code: trimmed, exerciseId, ...options })
  }

  /**
   * Invoke one simulated FastAPI route on the live worker app.
   * Does not re-execute the editor. No-op if no worker, busy, or no routes.
   */
  async invoke(request: InvokeRequest): Promise<void> {
    if (!this.worker || !this.ready || this.disposed) return
    if (this.activeId !== null || this.pendingSeq !== null || this.snapshot.status === 'running') return
    if (!this.snapshot.routes.length) return

    this.runCounter += 1
    const id = `invoke-${this.runCounter}`
    this.activeId = id
    this.activeExerciseId = undefined
    this.activeContextKey = undefined
    this.clearTimeout()
    this.setSnapshot({
      ...this.snapshot,
      status: 'running',
      runId: id,
      error: null,
    })

    this.timeoutHandle = setTimeout(() => {
      if (this.activeId === id) {
        this.handleTimeout(id)
      }
    }, this.timeoutMs)

    this.post({
      type: 'invoke',
      id,
      method: request.method,
      path: request.path,
      query: request.query,
      body: request.body,
      headers: request.headers,
    })
  }

  /** Cancel the current run by replacing the worker. */
  stop(): void {
    if (this.disposed) return
    this.requestSeq += 1
    this.pendingSeq = null
    const wasRunning = this.snapshot.status === 'running'
    const stoppedId = this.activeId
    const exerciseId = this.activeExerciseId
    const contextKey = this.activeContextKey
    this.clearTimeout()
    this.activeId = null
    this.activeExerciseId = undefined
    this.activeContextKey = undefined
    this.terminateWorker()
    this.spawnWorker()
    if (wasRunning) this.lastRunEvents = []
    this.setSnapshot({
      status: wasRunning ? 'stopped' : this.ready ? 'ready' : 'booting',
      events: wasRunning
        ? [
            {
              kind: 'warning',
              text: 'Execution stopped. The Python runner was reset.',
            },
          ]
        : [],
      durationMs: null,
      runId: wasRunning ? stoppedId : null,
      error: null,
      executedCode: wasRunning ? this.lastCode : this.snapshot.executedCode,
      routes: wasRunning ? [] : this.snapshot.routes,
      exerciseId: wasRunning ? exerciseId : undefined,
      contextKey: wasRunning ? contextKey : undefined,
      checks: [],
    })
  }

  dispose(): void {
    this.disposed = true
    this.requestSeq += 1
    this.pendingSeq = null
    this.clearTimeout()
    this.activeId = null
    this.activeExerciseId = undefined
    this.activeContextKey = undefined
    this.listeners.clear()
    this.terminateWorker()
  }

  private spawnWorker(): void {
    this.terminateWorker()
    this.ready = false
    this.tainted = false
    this.initFailed = false
    this.setSnapshot({
      ...this.snapshot,
      status: this.snapshot.status === 'stopped' ? 'stopped' : 'booting',
    })

    const worker = new Worker(
      new URL('./python.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (this.worker !== worker) return
      const message = readWorkerMessage(event.data)
      if (message) this.onWorkerMessage(message)
    }

    worker.onmessageerror = () => {
      if (this.worker !== worker || !this.activeId) return
      this.finishWithError(this.activeId, 'Python sent a result that could not be read.')
    }

    worker.onerror = (event) => {
      if (this.worker !== worker) return
      const message = RUNNER_ERROR
      const traceback = event.message || 'The Python worker failed to load or crashed without a message.'
      if (!this.ready) this.failInit()
      if (this.activeId) {
        this.finishWithError(this.activeId, message, traceback)
      } else {
        this.setSnapshot({
          status: 'error',
          events: [makeErrorEvent(message, traceback)],
          durationMs: null,
          runId: null,
          error: message,
          executedCode: this.lastCode || null,
          routes: [],
        })
      }
    }

    this.worker = worker
    this.post({ type: 'init' })
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.loadedPackages.clear()
    this.loadWaiters.forEach(({ resolve }) => resolve())
    this.loadWaiters.clear()
    this.ready = false
    this.settleReadyWaiters(false)
  }

  private waitUntilReady(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true)
    if (!this.worker || this.initFailed || this.disposed) return Promise.resolve(false)
    return new Promise((resolve) => {
      this.readyWaiters.push(resolve)
    })
  }

  private settleReadyWaiters(ready: boolean): void {
    const waiters = this.readyWaiters
    this.readyWaiters = []
    waiters.forEach((w) => w(ready))
  }

  private failInit(): void {
    this.initFailed = true
    this.pendingSeq = null
    this.settleReadyWaiters(false)
  }

  private onWorkerMessage(msg: WorkerOutboundMessage): void {
    if (!msg || typeof msg !== 'object') return

    if (msg.type === 'ready') {
      this.ready = true
      this.settleReadyWaiters(true)
      if (
        this.snapshot.status === 'booting' ||
        this.snapshot.status === 'idle' ||
        this.snapshot.status === 'stopped'
      ) {
        this.setSnapshot({
          ...this.snapshot,
          status: this.snapshot.status === 'stopped' ? 'stopped' : 'ready',
          error: null,
        })
      }
      return
    }

    if (msg.type === 'result') {
      if (msg.id !== this.activeId) return
      const exerciseId = this.activeExerciseId
    const contextKey = this.activeContextKey
      this.clearTimeout()
      this.activeId = null
      this.activeExerciseId = undefined
    this.activeContextKey = undefined
      const events = enrichEvents(msg.events, this.lastCode)
      const errorEvent = events.find((e) => e.kind === 'error')
      const hasError = errorEvent != null
      const isLoopStop =
        hasError &&
        /TimeoutError|infinite loop/i.test(errorEvent.message)
      const status = isLoopStop
        ? 'timeout'
        : hasError
          ? 'error'
          : 'success'
      const isInvoke = msg.id.startsWith('invoke-')
      if (isInvoke) {
        this.setSnapshot({
          status,
          events: [...this.lastRunEvents, ...events],
          durationMs: msg.durationMs,
          runId: msg.id,
          error: hasError ? errorEvent.message : null,
          executedCode: this.snapshot.executedCode ?? this.lastCode,
          routes: msg.routes ?? this.snapshot.routes,
        })
        return
      }
      this.lastRunEvents = events.filter((e) => e.kind !== 'http')
      this.setSnapshot({
        status,
        events,
        durationMs: msg.durationMs,
        runId: msg.id,
        error: hasError ? errorEvent.message : null,
        executedCode: this.lastCode,
        routes: msg.routes ?? [],
        exerciseId,
        contextKey,
        checks: msg.exerciseId === exerciseId && msg.contextKey === contextKey ? msg.checks ?? [] : [],
        ...(msg.fullstack ? { fullstack: msg.fullstack } : {}),
      })
      return
    }

    if (msg.type === 'loaded') {
      this.loadWaiters.get(msg.id)?.resolve()
      this.loadWaiters.delete(msg.id)
      return
    }

    if (msg.type === 'failed' && this.loadWaiters.has(msg.id)) {
      this.loadWaiters.get(msg.id)?.reject(new Error(msg.error))
      this.loadWaiters.delete(msg.id)
      return
    }

    if (msg.type === 'failed') {
      if (msg.id === 'init') {
        this.failInit()
        this.setSnapshot({
          status: 'error',
          events: [
            makeErrorEvent(
              'ImportError: Python failed to load',
              msg.error,
            ),
          ],
          durationMs: null,
          runId: null,
          error: msg.error,
          executedCode: null,
          routes: [],
        })
        return
      }
      if (msg.id !== this.activeId) return
      this.finishWithError(msg.id, msg.error)
    }
  }

  private finishWithError(id: string, error: string, traceback = error): void {
    const exerciseId = this.activeExerciseId
    const contextKey = this.activeContextKey
    this.clearTimeout()
    this.activeId = null
    this.activeExerciseId = undefined
    this.activeContextKey = undefined
    this.setSnapshot({
      status: 'error',
      events: [makeErrorEvent(error, traceback)],
      durationMs: null,
      runId: id,
      error,
      executedCode: this.lastCode || null,
      routes: id.startsWith('invoke-') ? this.snapshot.routes : [],
      exerciseId,
      contextKey,
      checks: [],
    })
  }

  private handleTimeout(id: string): void {
    const exerciseId = this.activeExerciseId
    const contextKey = this.activeContextKey
    this.clearTimeout()
    this.activeId = null
    this.activeExerciseId = undefined
    this.activeContextKey = undefined
    // Hard kill — worker may be stuck in a tight loop with no event turn.
    this.terminateWorker()
    this.spawnWorker()
    const seconds = Math.round(this.timeoutMs / 100) / 10
    this.lastRunEvents = []
    this.setSnapshot({
      status: 'timeout',
      events: [
        makeErrorEvent(
          'TimeoutError: possible infinite loop — stopped to protect the browser',
          `TimeoutError: This program ran longer than ${seconds}s without finishing and was force-stopped.\nThe Python runner was reset so the page stays responsive.`,
          undefined,
          this.lastCode,
        ),
      ],
      durationMs: this.timeoutMs,
      runId: id,
      error: 'timeout',
      executedCode: this.lastCode || null,
      routes: [],
      exerciseId,
      contextKey,
      checks: [],
    })
  }

  /** Loads Pyodide packages once per worker, outside any run so the run timeout does not include the download. */
  private async loadPackages(packages: string[]): Promise<void> {
    const missing = packages.filter((name) => !this.loadedPackages.has(name))
    if (!missing.length || !this.worker) return
    this.runCounter += 1
    const id = `load-${this.runCounter}`
    const worker = this.worker
    try {
      await new Promise<void>((resolve, reject) => {
        this.loadWaiters.set(id, { resolve, reject })
        this.post({ type: 'load', id, packages: missing })
      })
      if (this.worker === worker) missing.forEach((name) => this.loadedPackages.add(name))
    } catch {
      // The run itself reports the failed import with a normal Python error.
    }
  }

  private post(message: WorkerInboundMessage): void {
    this.worker?.postMessage(message)
  }

  private clearTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  private setSnapshot(next: RunnerSnapshot): void {
    this.snapshot = next
    for (const listener of this.listeners) {
      listener(next)
    }
  }
}
