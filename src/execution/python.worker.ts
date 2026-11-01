/// <reference lib="webworker" />
import { loadPyodide, type PyodideInterface } from 'pyodide'
import { PYTHON_PRELUDE } from './instrument'
import FASTAPI_SHIM from './fastapi_sim.py?raw'
import SERVICE_CHECKS_PY from './service_checks.py?raw'
import GENAI_PYTHON_CHECKS_PY from './genai_python_checks.py?raw'
import GENAI_SECURITY_CHECKS_PY from './genai_security_checks.py?raw'
import REFRESHER_FOUNDATIONS from './refresher_foundation_checks.py?raw'
import REFRESHER_ADVANCED from './refresher_advanced_checks.py?raw'
import REFRESHER_CHECKS from './refresher_checks.py?raw'
import PLAYDB_PY from './playdb.py?raw'
import type { ExerciseCheck, ExerciseId } from '../serviceExercise'
import type {
  DiscoveredRoute,
  FullstackPayload,
  ResultEvent,
  WorkerInboundMessage,
  WorkerOutboundMessage,
  RunCheckOptions,
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
      instance.FS.writeFile('/home/pyodide/fastapi_sim.py', FASTAPI_SHIM)
      instance.FS.writeFile('/home/pyodide/service_checks.py', SERVICE_CHECKS_PY)
      instance.FS.writeFile('/home/pyodide/genai_python_checks.py', GENAI_PYTHON_CHECKS_PY)
      instance.FS.writeFile('/home/pyodide/genai_security_checks.py', GENAI_SECURITY_CHECKS_PY)
      instance.FS.writeFile('/home/pyodide/refresher_foundation_checks.py', REFRESHER_FOUNDATIONS)
      instance.FS.writeFile('/home/pyodide/refresher_advanced_checks.py', REFRESHER_ADVANCED)
      instance.FS.writeFile('/home/pyodide/refresher_checks.py', REFRESHER_CHECKS)
      instance.FS.writeFile('/home/pyodide/playdb.py', PLAYDB_PY)
      instance.runPython(`
import sys
if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")
`)
      instance.runPython(PYTHON_PRELUDE)
      pyodide = instance
    })()
  }
  await initPromise
  return pyodide!
}

type PyRunPayload = {
  ok: boolean
  events: ResultEvent[]
  routes?: DiscoveredRoute[]
  checks?: ExerciseCheck[]
  fullstack?: FullstackPayload
}

async function runCode(id: string, code: string, exerciseId?: ExerciseId, options: RunCheckOptions = {}): Promise<void> {
  const start = performance.now()
  try {
    const py = await ensurePyodide()
    // Pass source via set() to avoid escaping pitfalls.
    py.globals.set('__plp_source__', code)
    py.globals.set('__plp_exercise__', exerciseId ?? null)
    py.globals.set('__plp_context__', JSON.stringify(options.context ?? {}))
    py.globals.set('__plp_fullstack__', options.fullstack ? JSON.stringify(options.fullstack) : null)
    // Enter Python through Pyodide's promising path so browser-local lessons
    // can use asyncio without a forbidden synchronous stack switch.
    const raw = (await py.runPythonAsync(
      'import json; json.dumps(await _plp_run_async(__plp_source__, __plp_exercise__, json.loads(__plp_context__), json.loads(__plp_fullstack__) if __plp_fullstack__ else None), default=str)',
    )) as string
    const parsed = JSON.parse(raw) as PyRunPayload
    post({
      type: 'result',
      id,
      events: parsed.events ?? [],
      durationMs: Math.round(performance.now() - start),
      routes: parsed.routes ?? [],
      exerciseId,
      contextKey: options.contextKey,
      checks: parsed.checks ?? [],
      ...(parsed.fullstack ? { fullstack: parsed.fullstack } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    post({ type: 'failed', id, error: message })
  }
}

async function invokeRoute(
  id: string,
  method: string,
  path: string,
  query?: Record<string, string>,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<void> {
  const start = performance.now()
  try {
    const py = await ensurePyodide()
    py.globals.set(
      '__plp_invoke_req__',
      JSON.stringify({ method, path, query, body, headers }),
    )
    const raw = (await py.runPythonAsync(
      'import json; json.dumps(_plp_invoke(json.loads(__plp_invoke_req__)))',
    )) as string
    const parsed = JSON.parse(raw) as PyRunPayload
    post({
      type: 'result',
      id,
      events: parsed.events ?? [],
      durationMs: Math.round(performance.now() - start),
      routes: parsed.routes ?? [],
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

  if (msg.type === 'load') {
    // Optional packages (sqlite3 for full-stack lessons) load outside a run, so the run's timeout does not count them.
    ensurePyodide()
      .then((py) => py.loadPackage(msg.packages))
      .then(() => post({ type: 'loaded', id: msg.id }))
      .catch((err: unknown) => post({ type: 'failed', id: msg.id, error: err instanceof Error ? err.message : String(err) }))
    return
  }

  if (msg.type === 'run') {
    void runCode(msg.id, msg.code, msg.exerciseId, { context: msg.context, contextKey: msg.contextKey, fullstack: msg.fullstack })
    return
  }

  if (msg.type === 'invoke') {
    void invokeRoute(
      msg.id,
      msg.method,
      msg.path,
      msg.query,
      msg.body,
      msg.headers,
    )
  }
}

export {}
