import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PythonRunner } from './PythonRunner'
import type { WorkerOutboundMessage } from './protocol'

type Handler = (event: MessageEvent<WorkerOutboundMessage>) => void

class MockWorker {
  static instances: MockWorker[] = []
  onmessage: Handler | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
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
    if (msg.type === 'init') {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'ready' } } as MessageEvent)
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
        this.onmessage?.({
          data: {
            type: 'result',
            id: run.id,
            events: [
              { kind: 'print', text: 'hello' },
              { kind: 'expr', value: '4', line: 2 },
            ],
            durationMs: 5,
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
    runner.dispose()
  })
})
