/// <reference lib="webworker" />
import { loadPyodide, type PyodideInterface } from 'pyodide'
import { PYTHON_PRELUDE } from './instrument'
import type {
  ResultEvent,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './protocol'

const PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'

let pyodide: PyodideInterface | null = null
let initPromise: Promise<void> | null = null

function post(message: WorkerOutboundMessage): void {
  self.postMessage(message)
}

async function ensurePyodide(): Promise<PyodideInterface> {
  if (pyodide) return pyodide
  if (!initPromise) {
    initPromise = (async () => {
      const instance = await loadPyodide({ indexURL: PYODIDE_INDEX })
      instance.runPython(PYTHON_PRELUDE)
      pyodide = instance
    })()
  }
  await initPromise
  return pyodide!
}

async function runCode(id: string, code: string): Promise<void> {
  const start = performance.now()
  try {
    const py = await ensurePyodide()
    // Pass source via set() to avoid escaping pitfalls.
    py.globals.set('__plp_source__', code)
    const raw = py.runPython(
      'import json; json.dumps(_plp_run(__plp_source__))',
    ) as string
    const parsed = JSON.parse(raw) as {
      ok: boolean
      events: ResultEvent[]
    }
    post({
      type: 'result',
      id,
      events: parsed.events ?? [],
      durationMs: Math.round(performance.now() - start),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    post({ type: 'failed', id, error: message })
  }
}

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'init') {
    ensurePyodide()
      .then(() => post({ type: 'ready' }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        post({ type: 'failed', id: 'init', error: message })
      })
    return
  }

  if (msg.type === 'run') {
    void runCode(msg.id, msg.code)
  }
}

export {}
