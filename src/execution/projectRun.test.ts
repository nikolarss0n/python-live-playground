import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'
import type { ProjectRun, ResultEvent } from './protocol'
import { readWorkerMessage } from './workerMessages'

function run(project: ProjectRun): ResultEvent[] {
  const driver = `import asyncio, json, sys
request = json.load(sys.stdin)
exec(request["prelude"])
result = asyncio.run(_plp_run_project(request["project"], "ok"))
print(json.dumps(result))
`
  const output = execFileSync('python3', ['-I', '-c', driver], {
    input: JSON.stringify({ prelude: PYTHON_PRELUDE, project }),
    encoding: 'utf8', timeout: 8_000,
  })
  const payload: unknown = JSON.parse(output)
  if (!payload || typeof payload !== 'object') throw new Error('Expected a Python payload')
  const result = readWorkerMessage({ type: 'result', id: 'test', ...payload })
  if (result?.type !== 'result') throw new Error('Expected a Python result')
  return result.events
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
})
