import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'
import type { DiscoveredRoute, InvokeRequest, ProjectRun, ResultEvent } from './protocol'
import { readWorkerMessage } from './workerMessages'

const FASTAPI_SIM = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fastapi_sim.py'), 'utf8')

function runAndInvoke(project: ProjectRun, requests: InvokeRequest[] = []): {
  events: ResultEvent[]
  routes: DiscoveredRoute[]
  invocations: ResultEvent[][]
} {
  const driver = `import asyncio, json, sys, types
request = json.load(sys.stdin)
sim = types.ModuleType("fastapi_sim")
exec(compile(request["fastapiSim"], "fastapi_sim.py", "exec"), sim.__dict__)
sys.modules["fastapi_sim"] = sim
exec(request["prelude"])
ran = asyncio.run(_plp_run_project(request["project"], "ok"))
invocations = [_plp_invoke(call) for call in request["requests"]]
print(json.dumps({"ran": ran, "invocations": invocations}))
`
  const output = execFileSync('python3', ['-I', '-c', driver], {
    input: JSON.stringify({ prelude: PYTHON_PRELUDE, fastapiSim: FASTAPI_SIM, project, requests }),
    encoding: 'utf8', timeout: 8_000,
  })
  const parsed = JSON.parse(output) as { ran: Record<string, unknown>; invocations: Record<string, unknown>[] }
  const ran = readWorkerMessage({ type: 'result', id: 'test', ...parsed.ran })
  if (ran?.type !== 'result') throw new Error('Expected a Python result')
  const invocations = parsed.invocations.map((entry, index) => {
    const msg = readWorkerMessage({ type: 'result', id: `invoke-${index}`, ...entry })
    if (msg?.type !== 'result') throw new Error('Expected an invoke result')
    return msg.events
  })
  return { events: ran.events, routes: ran.routes ?? [], invocations }
}

function run(project: ProjectRun): ResultEvent[] {
  return runAndInvoke(project).events
}

describe('project execution', () => {
  it('runs the entry, imports nested package files, reads relative data and attributes each result', () => {
    const events = run({
      entry: 'app/main.py',
      files: {
        'app/main.py': '"""Entry"""\nfrom __future__ import annotations\nfrom helpers import greet\nawait greet()\n__doc__',
        'helpers/__init__.py': 'from .message import greet',
        'helpers/message.py': 'from pathlib import Path\nasync def greet():\n    print(Path("data/name.txt").read_text())\n    print(input())',
        'data/name.txt': 'Maria',
      },
    })
    expect(events).toEqual([
      { kind: 'print', file: 'helpers/message.py', line: 3, text: 'Maria' },
      { kind: 'print', file: 'helpers/message.py', line: 4, text: 'ok' },
      { kind: 'print', file: 'helpers/message.py', line: 4, text: 'ok' },
      { kind: 'expr', file: 'app/main.py', line: 5, value: "'Entry'" },
    ])
  })

  it('exposes empty project folders to Python', () => {
    expect(run({ entry: 'main.py', folders: ['reports/weekly'], files: {
      'main.py': 'from pathlib import Path\nprint(Path("reports/weekly").is_dir())',
    } })).toMatchObject([{ kind: 'print', text: 'True' }])
  })

  it('points to the failing imported file and preserves the caller frame', () => {
    const events = run({
      entry: 'main.py',
      files: { 'main.py': 'from helper import fail\nfail()', 'helper.py': 'def fail():\n    return 1 / 0' },
    })
    expect(events).toMatchObject([{
      kind: 'error', file: 'helper.py', line: 2,
      frames: [{ file: 'main.py', line: 2 }, { file: 'helper.py', line: 2 }],
    }])
  })

  it('attributes direct writes even when Python flushes a final partial line', () => {
    expect(run({
      entry: 'main.py',
      files: { 'main.py': 'import helper', 'helper.py': 'import sys\nsys.stdout.write("partial")' },
    })).toMatchObject([{ kind: 'print', text: 'partial', file: 'helper.py', line: 2 }])
  })

  it('attributes imported syntax errors to the offending file', () => {
    expect(run({
      entry: 'main.py', files: { 'main.py': 'import helper', 'helper.py': 'x = )' },
    })).toMatchObject([{ kind: 'error', file: 'helper.py', line: 1 }])
  })

  it('discovers FastAPI routes across modules, reads project files on invoke, and reports the crashing module file and line', () => {
    const { routes, invocations } = runAndInvoke(
      {
        entry: 'main.py',
        files: {
          'main.py': 'from fastapi import FastAPI\nfrom routes.books import router\napp = FastAPI()\napp.include_router(router)\n',
          'routes/__init__.py': '',
          'routes/books.py': [
            'from pathlib import Path',
            'from fastapi import APIRouter',
            'router = APIRouter(prefix="/books")',
            '@router.get("/title")',
            'def read_title():',
            '    return {"title": Path("data/title.txt").read_text().strip()}',
            '@router.get("/crash")',
            'def crash(by: int = 0):',
            '    return {"ratio": 10 / by}',
          ].join('\n'),
          'data/title.txt': 'Dune\n',
        },
      },
      [
        { method: 'GET', path: '/books/title' },
        { method: 'GET', path: '/books/crash', query: { by: '0' } },
      ],
    )
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(['GET /books/title', 'GET /books/crash'])
    expect(invocations[0]).toMatchObject([{ kind: 'http', status: 200, body: '{"title": "Dune"}' }])
    expect(invocations[1]).toMatchObject([{ kind: 'http', status: 500, file: 'routes/books.py', line: 9 }])
  })
})
