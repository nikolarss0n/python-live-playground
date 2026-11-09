import { describe, expect, it } from 'vitest'
import { isPythonWorkerUrl, PYTHON_WORKER_CSP } from '../vite.workerCsp'

describe('Python worker content security policy', () => {
  it('matches the worker in dev and in a build, and nothing else', () => {
    expect(isPythonWorkerUrl('/src/execution/python.worker.ts?worker_file&type=module')).toBe(true)
    expect(isPythonWorkerUrl('/assets/python.worker-DpDL93GD.js')).toBe(true)
    expect(isPythonWorkerUrl('/src/execution/PythonRunner.ts')).toBe(false)
    expect(isPythonWorkerUrl('/')).toBe(false)
    expect(isPythonWorkerUrl(undefined)).toBe(false)
  })

  it('lets the worker fetch only the Pyodide CDN, never its own origin', () => {
    const connect = PYTHON_WORKER_CSP.split('; ').find((part) => part.startsWith('connect-src'))
    expect(connect).toBe('connect-src https://cdn.jsdelivr.net')
    expect(PYTHON_WORKER_CSP).toContain("default-src 'none'")
    // worker-src 'none' blocks the worker's own module imports in Firefox.
    expect(PYTHON_WORKER_CSP).toContain("worker-src 'self' https://cdn.jsdelivr.net")
  })
})
