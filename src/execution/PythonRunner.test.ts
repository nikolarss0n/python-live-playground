import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PythonRunner } from './PythonRunner'
import type { WorkerOutboundMessage } from './protocol'

type Handler = (event: MessageEvent<WorkerOutboundMessage>) => void

class MockWorker {
  static instances: MockWorker[] = []
  /** When true, init waits for the test to emit 'ready' or 'failed'. */
  static holdInit = false
  onmessage: Handler | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false
  posted: unknown[] = []
  url: URL | string
  options?: WorkerOptions

  constructor(url: URL | string, options?: WorkerOptions) {
    this.url = url
    this.options = options
    MockWorker.instances.push(this)
  }

  postMessage(data: unknown) {
    this.posted.push(data)
    const msg = data as { type?: string }
    if (msg.type === 'init' && !MockWorker.holdInit) {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'ready' } } as MessageEvent)
      })
    }
    if (msg.type === 'invoke') {
      const invoke = data as { id: string; method: string; path: string }
      queueMicrotask(() => {
        if (this.terminated) return
        this.onmessage?.({
          data: {
            type: 'result',
            id: invoke.id,
            events: [
              {
                kind: 'http',
                method: invoke.method,
                path: invoke.path,
                status: 200,
                body: '{"message":"hi"}',
                simulated: true,
              },
            ],
            durationMs: 2,
            routes: [
              { method: 'GET', path: '/hello', callPath: '/hello' },
            ],
          },
        } as MessageEvent)
      })
    }
    if (msg.type === 'run') {
      const run = data as { id: string; code: string }
      queueMicrotask(() => {
        if (this.terminated) return
        if (run.code.includes('__HANG__')) {
          // Never reply — lets timeout tests work.
          return
        }
        if (run.code.includes('raise')) {
          this.onmessage?.({
            data: {
              type: 'result',
              id: run.id,
              events: [
                {
                  kind: 'error',
                  message: 'RuntimeError: boom',
                  friendly: 'Something went wrong',
                  traceback: 'Traceback…',
                  line: 1,
                },
              ],
              durationMs: 3,
            },
          } as MessageEvent)
          return
        }
        const isFastApi = run.code.includes('FastAPI')
        this.onmessage?.({
          data: {
            type: 'result',
            id: run.id,
            events: [
              { kind: 'print', text: 'hello' },
              { kind: 'expr', value: '4', line: 2 },
            ],
            durationMs: 5,
            routes: isFastApi
              ? [{ method: 'GET', path: '/hello', callPath: '/hello' }]
              : [],
          },
        } as MessageEvent)
      })
    }
  }

  terminate() {
    this.terminated = true
  }

  /** Simulate a late result after terminate (should be ignored). */
  emit(data: WorkerOutboundMessage) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

describe('PythonRunner', () => {
  it('terminates an active worker when the editor is cleared', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    await runner.run('__HANG__')
    const busy = MockWorker.instances.at(-1)
    await runner.run('')
    expect(busy?.terminated).toBe(true)
    expect(runner.getSnapshot().events).toEqual([])
    await runner.run('print("recovered")')
    await Promise.resolve()
    expect(runner.getSnapshot().status).toBe('success')
    runner.dispose()
  })

  it('announces initial readiness after an empty edit during boot', async () => {
    const runner = new PythonRunner()
    const started = runner.start()
    await runner.run('')
    await started
    expect(runner.getSnapshot().status).toBe('ready')
    runner.dispose()
  })

  it('discards checks from a different mock requirement or study phase', async () => {
    const runner = new PythonRunner()
    await runner.start()
    await runner.run('__HANG__', 'refresher-13', { context: { variant: 'a', followUp: true }, contextKey: 'a-follow-up' })
    const worker = MockWorker.instances.at(-1)
    const id = runner.getSnapshot().runId
    if (!worker || !id) throw new Error('Expected active worker')
    worker.emit({ type: 'result', id, exerciseId: 'refresher-13', contextKey: 'a-initial', durationMs: 1, events: [],
      checks: [{ id: 'check', label: 'Old context', passed: true, detail: 'Passed' }] })
    expect(runner.getSnapshot()).toMatchObject({ contextKey: 'a-follow-up', checks: [] })
    runner.dispose()
  })
  beforeEach(() => {
    MockWorker.instances = []
    vi.stubGlobal(
      'Worker',
      MockWorker as unknown as typeof Worker,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('gives the next trusted run a fresh worker after untrusted code ran', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    const first = MockWorker.instances.at(-1)
    await runner.run('print(1)')
    await runner.run('print(2)')
    expect(MockWorker.instances.at(-1)).toBe(first)
    await runner.run('shared()', undefined, {}, true)
    await runner.run('shared()', undefined, {}, true)
    expect(MockWorker.instances.at(-1)).toBe(first)
    await runner.run('mine()')
    const fresh = MockWorker.instances.at(-1)
    expect(fresh).not.toBe(first)
    expect(first?.terminated).toBe(true)
    await runner.run('mine_again()')
    expect(MockWorker.instances.at(-1)).toBe(fresh)
    runner.dispose()
  })

  it('ignores malformed results instead of passing them to the page', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    await runner.run('__HANG__')
    const worker = MockWorker.instances.at(-1)
    const id = runner.getSnapshot().runId
    if (!worker || !id) throw new Error('Expected active worker')
    worker.emit({ type: 'result', id, durationMs: 1, events: [{ kind: 'print', text: { x: 1 } }, { kind: 'print', text: 'ok' }] } as unknown as WorkerOutboundMessage)
    expect(runner.getSnapshot().events).toEqual([{ kind: 'print', text: 'ok' }])
    runner.dispose()
  })

  it('ends the run with an error when a worker message cannot be decoded', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    await runner.run('__HANG__')
    const worker = MockWorker.instances.at(-1)
    if (!worker) throw new Error('Expected active worker')
    worker.onmessageerror?.()
    expect(runner.getSnapshot()).toMatchObject({ status: 'error', error: 'Python sent a result that could not be read.' })
    runner.dispose()
  })

  it('boots the worker and becomes ready', async () => {
    const runner = new PythonRunner(1000)
    const statuses: string[] = []
    runner.subscribe((s) => statuses.push(s.status))
    await runner.start()
    expect(statuses).toContain('ready')
    expect(MockWorker.instances.length).toBeGreaterThanOrEqual(1)
    runner.dispose()
  })

  it('runs code and reports print + expression events', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    const done = new Promise<void>((resolve) => {
      runner.subscribe((s) => {
        if (s.status === 'success') resolve()
      })
    })
    await runner.run('print("hello")\n2+2')
    await done
    const snap = runner.getSnapshot()
    expect(snap.status).toBe('success')
    expect(snap.events.some((e) => e.kind === 'print')).toBe(true)
    expect(snap.events.some((e) => e.kind === 'expr')).toBe(true)
    runner.dispose()
  })

  it('surfaces runtime errors as error status', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    const done = new Promise<void>((resolve) => {
      runner.subscribe((s) => {
        if (s.status === 'error') resolve()
      })
    })
    await runner.run('raise RuntimeError("boom")')
    await done
    expect(runner.getSnapshot().status).toBe('error')
    runner.dispose()
  })

  it('stop terminates the worker and recreates it', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    const first = MockWorker.instances[0]
    await runner.run('print(1)')
    // wait for success
    await new Promise((r) => setTimeout(r, 10))
    runner.stop()
    expect(first?.terminated).toBe(true)
    expect(MockWorker.instances.length).toBeGreaterThan(1)
    runner.dispose()
  })

  it('timeouts replace the worker and mark infinite-loop style error', async () => {
    vi.useFakeTimers()
    const runner = new PythonRunner(50)
    await runner.start()
    const first = MockWorker.instances[0]
    const promise = runner.run('__HANG__')
    await promise
    await vi.advanceTimersByTimeAsync(60)
    const snap = runner.getSnapshot()
    expect(snap.status).toBe('timeout')
    expect(first?.terminated).toBe(true)
    const err = snap.events.find((e) => e.kind === 'error')
    expect(err?.kind === 'error' && err.message).toMatch(/infinite loop|time/i)
    runner.dispose()
  })

  it('keeps the last results on screen while the next run is running', async () => {
    const runner = new PythonRunner(5000)
    await runner.start()
    await runner.run('print("hello")')
    await vi.waitFor(() => expect(runner.getSnapshot().status).toBe('success'))
    const finished = runner.getSnapshot()
    await runner.run('__HANG__')
    const running = runner.getSnapshot()
    expect(running.status).toBe('running')
    expect(running.events).toBe(finished.events)
    expect(running.durationMs).toBe(finished.durationMs)
    expect(running.executedCode).toBeNull()
    runner.dispose()
  })

  it('kills a busy worker before starting a new run', async () => {
    const runner = new PythonRunner(5000)
    await runner.start()
    const first = MockWorker.instances[0]
    await runner.run('__HANG__')
    expect(runner.getSnapshot().status).toBe('running')
    // New run must terminate the hung worker so messages are not queued forever.
    await runner.run('print(1)')
    expect(first?.terminated).toBe(true)
    expect(MockWorker.instances.length).toBeGreaterThan(1)
    runner.dispose()
  })

  it('treats empty code as idle', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    await runner.run('   \n  ')
    expect(runner.getSnapshot().status).toBe('idle')
    expect(runner.getSnapshot().events).toEqual([])
    expect(runner.getSnapshot().routes).toEqual([])
    runner.dispose()
  })

  it('keeps exercise checks tied to the run and clears them when the source changes', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    await runner.run('__HANG__', 'service-validation')
    const worker = MockWorker.instances.at(-1)
    const runId = runner.getSnapshot().runId
    if (!worker || !runId) throw new Error('Expected an active worker run')
    expect(worker.posted).toContainEqual({ type: 'run', id: runId, code: '__HANG__', exerciseId: 'service-validation' })
    const checks = [{ id: 'valid-question', label: 'Return a trimmed question', passed: true, detail: 'Passed' }]
    worker.emit({ type: 'result', id: runId, events: [], durationMs: 2, exerciseId: 'service-validation', checks })
    expect(runner.getSnapshot()).toMatchObject({ exerciseId: 'service-validation', checks, executedCode: '__HANG__' })
    await runner.run('__HANG__ edited', 'service-endpoint')
    expect(runner.getSnapshot().checks).toBeUndefined()
    expect(runner.getSnapshot().exerciseId).toBeUndefined()
    worker.emit({ type: 'result', id: runId, events: [], durationMs: 2, exerciseId: 'service-validation', checks })
    expect(runner.getSnapshot().status).toBe('running')
    expect(runner.getSnapshot().checks).toBeUndefined()
    runner.dispose()
  })

  it('stops or times out exercise probes through the same replaceable worker', async () => {
    vi.useFakeTimers()
    const runner = new PythonRunner(50)
    await runner.start()
    await runner.run('__HANG__', 'service-tests')
    const first = MockWorker.instances.at(-1)
    await vi.advanceTimersByTimeAsync(60)
    expect(first?.terminated).toBe(true)
    expect(runner.getSnapshot().status).toBe('timeout')
    expect(runner.getSnapshot()).toMatchObject({
      exerciseId: 'service-tests', executedCode: '__HANG__', checks: [],
    })
    await runner.run('__HANG__ again', 'service-tests')
    const second = MockWorker.instances.at(-1)
    runner.stop()
    expect(second?.terminated).toBe(true)
    expect(runner.getSnapshot()).toMatchObject({
      status: 'stopped', exerciseId: 'service-tests', executedCode: '__HANG__ again', checks: [],
    })
    await vi.advanceTimersByTimeAsync(1)
    expect(runner.getSnapshot().status).toBe('stopped')
    runner.dispose()
  })

  it('binds failed worker replies and worker errors to the active exercise', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    for (const kind of ['failed', 'error']) {
      await runner.run('__HANG__', 'service-validation')
      const worker = MockWorker.instances.at(-1)
      const runId = runner.getSnapshot().runId
      if (!worker || !runId) throw new Error('Expected an active worker run')
      if (kind === 'failed') worker.emit({ type: 'failed', id: runId, error: 'Unexpected failure' })
      else worker.onerror?.(new ErrorEvent('error', { message: 'Worker crashed' }))
      expect(runner.getSnapshot()).toMatchObject({
        status: 'error', exerciseId: 'service-validation', executedCode: '__HANG__', checks: [],
      })
      if (kind === 'error') {
        expect(runner.getSnapshot().events[0]).toMatchObject({
          kind: 'error', message: 'RunnerError: Python stopped working in this tab.', traceback: 'Worker crashed',
        })
      }
    }
    runner.dispose()
  })

  it('discards mismatched exercise checks and late errors from replaced workers', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    await runner.run('__HANG__', 'service-validation')
    const oldWorker = MockWorker.instances.at(-1)
    await runner.run('__HANG__ next', 'service-endpoint')
    oldWorker?.onerror?.(new ErrorEvent('error', { message: 'Old worker crashed' }))
    expect(runner.getSnapshot().status).toBe('running')
    const worker = MockWorker.instances.at(-1)
    const runId = runner.getSnapshot().runId
    if (!worker || !runId) throw new Error('Expected an active worker run')
    worker.emit({
      type: 'result', id: runId, events: [], durationMs: 1, exerciseId: 'service-validation',
      checks: [{ id: 'valid-question', label: 'Return a trimmed question', passed: true, detail: 'Passed' }],
    })
    expect(runner.getSnapshot()).toMatchObject({ exerciseId: 'service-endpoint', checks: [] })
    runner.dispose()
  })

  it('stores discovered routes from a FastAPI run', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    const done = new Promise<void>((resolve) => {
      runner.subscribe((s) => {
        if (s.status === 'success') resolve()
      })
    })
    await runner.run('from fastapi import FastAPI\napp = FastAPI()')
    await done
    expect(runner.getSnapshot().routes).toEqual([
      { method: 'GET', path: '/hello', callPath: '/hello' },
    ])
    runner.dispose()
  })

  it('invoke posts Call to the same worker and keeps routes', async () => {
    const runner = new PythonRunner(1000)
    await runner.start()
    const done = new Promise<void>((resolve) => {
      runner.subscribe((s) => {
        if (s.status === 'success' && s.routes.length) resolve()
      })
    })
    await runner.run('from fastapi import FastAPI\napp = FastAPI()')
    await done
    const worker = MockWorker.instances[MockWorker.instances.length - 1]
    const invokeDone = new Promise<void>((resolve) => {
      runner.subscribe((s) => {
        if (s.events.some((e) => e.kind === 'http')) resolve()
      })
    })
    await runner.invoke({
      method: 'POST',
      path: '/users',
      query: { verbose: '1' },
      body: { name: 'Ada' },
      headers: { Authorization: 'Bearer secret' },
    })
    await invokeDone
    expect(
      worker?.posted.some(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { type?: string }).type === 'invoke' &&
          (m as { headers?: { Authorization?: string } }).headers
            ?.Authorization === 'Bearer secret' &&
          (m as { body?: { name?: string } }).body?.name === 'Ada',
      ),
    ).toBe(true)
    expect(
      worker?.posted.some((m) => (m as { type?: string }).type === 'run'),
    ).toBe(true)
    const snap = runner.getSnapshot()
    expect(snap.routes).toHaveLength(1)
    const http = snap.events.find((e) => e.kind === 'http')
    expect(http?.kind === 'http' && http.status).toBe(200)
    expect(http?.kind === 'http' && http.path).toBe('/users')
    runner.dispose()
  })
})

describe('PythonRunner request ownership', () => {
  const flush = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve()
  }
  const postedRuns = () =>
    MockWorker.instances.flatMap((w) =>
      (w.posted as Array<{ type: string; code?: string }>).filter((m) => m.type === 'run').map((m) => m.code),
    )

  beforeEach(() => {
    MockWorker.instances = []
    MockWorker.holdInit = true
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker)
  })

  afterEach(() => {
    MockWorker.holdInit = false
    vi.unstubAllGlobals()
  })

  it('reuses a booting worker and only runs the latest request', async () => {
    const runner = new PythonRunner()
    void runner.start()
    const first = runner.run('print("a")')
    const second = runner.run('print("b")')
    await flush()
    expect(MockWorker.instances).toHaveLength(1)
    MockWorker.instances[0].emit({ type: 'ready' })
    await Promise.all([first, second])
    expect(postedRuns()).toEqual(['print("b")'])
    runner.dispose()
  })

  it('never runs a request that was stopped while the worker booted', async () => {
    const runner = new PythonRunner()
    void runner.start()
    const pending = runner.run('print("stopped")')
    runner.stop()
    await pending
    MockWorker.instances.at(-1)?.emit({ type: 'ready' })
    await flush()
    expect(postedRuns()).toEqual([])
    expect(runner.getSnapshot().status).toBe('ready')
    runner.dispose()
  })

  it('does not let an older full-stack run overwrite a newer one after loading', async () => {
    const runner = new PythonRunner()
    const started = runner.start()
    MockWorker.instances[0].emit({ type: 'ready' })
    await started
    const worker = MockWorker.instances[0]
    const older = runner.run('print("old")', undefined, { fullstack: true })
    await flush()
    const load = (worker.posted as Array<{ type: string; id: string }>).find((m) => m.type === 'load')
    if (!load) throw new Error('Expected package load')
    await runner.run('print("new")')
    await flush()
    worker.emit({ type: 'loaded', id: load.id })
    await older
    await flush()
    expect(postedRuns()).toEqual(['print("new")'])
    expect(runner.getSnapshot()).toMatchObject({ status: 'success', executedCode: 'print("new")' })
    runner.dispose()
  })

  it('settles a pending run when boot fails and boots a fresh worker for the next run', async () => {
    const runner = new PythonRunner()
    void runner.start()
    const pending = runner.run('print("a")')
    await flush()
    MockWorker.instances[0].emit({ type: 'failed', id: 'init', error: 'network down' })
    await pending
    expect(runner.getSnapshot().status).toBe('error')
    expect(postedRuns()).toEqual([])

    const retry = runner.run('print("b")')
    await flush()
    expect(MockWorker.instances).toHaveLength(2)
    MockWorker.instances[1].emit({ type: 'ready' })
    await retry
    expect(postedRuns()).toEqual(['print("b")'])
    runner.dispose()
  })

  it('settles a pending run on dispose without posting it', async () => {
    const runner = new PythonRunner()
    void runner.start()
    const pending = runner.run('print("a")')
    runner.dispose()
    await pending
    expect(postedRuns()).toEqual([])
  })

  it('ignores invoke while a run is still preparing its worker', async () => {
    const runner = new PythonRunner()
    const started = runner.start()
    const worker = MockWorker.instances[0]
    worker.emit({ type: 'ready' })
    await started
    await runner.run('app = FastAPI()')
    await flush()
    expect(runner.getSnapshot().routes).toHaveLength(1)

    const pending = runner.run('app = FastAPI()  # edited', undefined, { fullstack: true })
    await flush()
    await runner.invoke({ method: 'GET', path: '/hello' })
    expect((worker.posted as Array<{ type: string }>).some((m) => m.type === 'invoke')).toBe(false)
    const load = (worker.posted as Array<{ type: string; id: string }>).find((m) => m.type === 'load')
    if (load) worker.emit({ type: 'loaded', id: load.id })
    await pending
    runner.dispose()
  })
})
