import type {
  ExecutionStatus,
  ResultEvent,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './protocol'
import { DEFAULT_TIMEOUT_MS } from './protocol'
import { enrichErrorEvent, explainError } from './errorExplain'

function makeErrorEvent(
  message: string,
  traceback: string,
  line?: number,
): ResultEvent {
  const explanation = explainError(message)
  return enrichErrorEvent({
    kind: 'error',
    message,
    friendly: `${explanation.name}: ${explanation.detail}\n\n${explanation.summary}\n\n${explanation.tip}`,
    traceback,
    line,
    explanation,
  })
}

function enrichEvents(events: ResultEvent[]): ResultEvent[] {
  return events.map((e) => (e.kind === 'error' ? enrichErrorEvent(e) : e))
}

export type RunnerSnapshot = {
  status: ExecutionStatus
  events: ResultEvent[]
  durationMs: number | null
  runId: string | null
  error: string | null
}

export type RunnerListener = (snapshot: RunnerSnapshot) => void

/**
 * Owns the Pyodide web worker lifecycle.
 * Stop / timeout terminate the worker and create a fresh one.
 */
export class PythonRunner {
  private worker: Worker | null = null
  private ready = false
  private readyWaiters: Array<() => void> = []
  private listeners = new Set<RunnerListener>()
  private runCounter = 0
  private activeId: string | null = null
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private timeoutMs: number
  private snapshot: RunnerSnapshot = {
    status: 'booting',
    events: [],
    durationMs: null,
    runId: null,
    error: null,
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

  async run(code: string): Promise<void> {
    const trimmed = code
    if (!trimmed.trim()) {
      this.clearTimeout()
      this.activeId = null
      this.setSnapshot({
        status: 'idle',
        events: [],
        durationMs: null,
        runId: null,
        error: null,
      })
      return
    }

    if (!this.worker || !this.ready) {
      this.spawnWorker()
      await this.waitUntilReady()
    }

    this.runCounter += 1
    const id = `run-${this.runCounter}`
    this.activeId = id
    this.clearTimeout()
    this.setSnapshot({
      status: 'running',
      events: [],
      durationMs: null,
      runId: id,
      error: null,
    })

    this.timeoutHandle = setTimeout(() => {
      if (this.activeId === id) {
        this.handleTimeout(id)
      }
    }, this.timeoutMs)

    this.post({ type: 'run', id, code: trimmed })
  }

  /** Cancel the current run by replacing the worker. */
  stop(): void {
    const wasRunning = this.snapshot.status === 'running'
    this.clearTimeout()
    this.activeId = null
    this.terminateWorker()
    this.spawnWorker()
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
      runId: null,
      error: null,
    })
  }

  dispose(): void {
    this.clearTimeout()
    this.activeId = null
    this.listeners.clear()
    this.terminateWorker()
  }

  private spawnWorker(): void {
    this.terminateWorker()
    this.ready = false
    this.setSnapshot({
      ...this.snapshot,
      status: this.snapshot.status === 'stopped' ? 'stopped' : 'booting',
    })

    const worker = new Worker(
      new URL('./python.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      this.onWorkerMessage(event.data)
    }

    worker.onerror = (event) => {
      const message = event.message || 'Worker error'
      if (this.activeId) {
        this.finishWithError(this.activeId, message)
      } else {
        this.setSnapshot({
          status: 'error',
          events: [makeErrorEvent(message, message)],
          durationMs: null,
          runId: null,
          error: message,
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
    this.ready = false
    this.readyWaiters = []
  }

  private waitUntilReady(): Promise<void> {
    if (this.ready) return Promise.resolve()
    return new Promise((resolve) => {
      this.readyWaiters.push(resolve)
    })
  }

  private onWorkerMessage(msg: WorkerOutboundMessage): void {
    if (!msg || typeof msg !== 'object') return

    if (msg.type === 'ready') {
      this.ready = true
      const waiters = this.readyWaiters
      this.readyWaiters = []
      waiters.forEach((w) => w())
      if (
        this.snapshot.status === 'booting' ||
        this.snapshot.status === 'stopped'
      ) {
        this.setSnapshot({
          ...this.snapshot,
          status: 'ready',
          error: null,
        })
      }
      return
    }

    if (msg.type === 'result') {
      if (msg.id !== this.activeId) return
      this.clearTimeout()
      this.activeId = null
      const events = enrichEvents(msg.events)
      const hasError = events.some((e) => e.kind === 'error')
      this.setSnapshot({
        status: hasError ? 'error' : 'success',
        events,
        durationMs: msg.durationMs,
        runId: msg.id,
        error: hasError
          ? events.find((e) => e.kind === 'error')?.message ?? null
          : null,
      })
      return
    }

    if (msg.type === 'failed') {
      if (msg.id === 'init') {
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
        })
        return
      }
      if (msg.id !== this.activeId) return
      this.finishWithError(msg.id, msg.error)
    }
  }

  private finishWithError(id: string, error: string): void {
    this.clearTimeout()
    this.activeId = null
    this.setSnapshot({
      status: 'error',
      events: [makeErrorEvent(error, error)],
      durationMs: null,
      runId: id,
      error,
    })
  }

  private handleTimeout(id: string): void {
    this.clearTimeout()
    this.activeId = null
    this.terminateWorker()
    this.spawnWorker()
    this.setSnapshot({
      status: 'timeout',
      events: [
        makeErrorEvent(
          'TimeoutError: execution exceeded the time limit',
          'TimeoutError: This program ran longer than 5 seconds and was stopped.\nThe Python runner has been reset so you can try again.',
        ),
      ],
      durationMs: this.timeoutMs,
      runId: id,
      error: 'timeout',
    })
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
