import type { Connect, Plugin } from 'vite'

const PYODIDE_CDN = 'https://cdn.jsdelivr.net'

/**
 * Policy for the Python worker. Learner code can reach JavaScript through Pyodide, so the worker may load
 * its own modules and Pyodide from the CDN but may not fetch same-origin routes (the Jev proxy) or any other host.
 */
export const PYTHON_WORKER_CSP = [
  "default-src 'none'",
  `script-src 'self' ${PYODIDE_CDN} 'wasm-unsafe-eval'`,
  `connect-src ${PYODIDE_CDN}`,
  // Firefox checks a module worker's own imports against worker-src, so it must allow what script-src allows.
  `worker-src 'self' ${PYODIDE_CDN}`,
].join('; ')

/** Dev serves `/src/execution/python.worker.ts?worker_file…`; a build emits `/assets/python.worker-<hash>.js`. */
export function isPythonWorkerUrl(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0]
  return /\/python\.worker(?:\.ts|-[\w-]+\.js)$/.test(path)
}

export function pythonWorkerCsp(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (isPythonWorkerUrl(req.url)) res.setHeader('Content-Security-Policy', PYTHON_WORKER_CSP)
    next()
  }
  return {
    name: 'python-live-worker-csp',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
