import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'

function run(source: string, exerciseId: string | null) {
  const script = `import asyncio, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
request = json.loads(sys.stdin.read())
exec(request["prelude"], globals())
async def verify():
    before = asyncio.all_tasks()
    payload = await _plp_run_async(request["source"], request["exerciseId"])
    pending = len([task for task in asyncio.all_tasks() - before if not task.done()])
    return {"ok": payload["ok"], "pending": pending, "serialized": json.dumps(payload)}
print(json.dumps(asyncio.run(verify())))
`
  const output = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ source, exerciseId, prelude: PYTHON_PRELUDE }),
    encoding: 'utf8', timeout: 8_000,
  })
  const result: unknown = JSON.parse(output)
  return result
}

const backgroundWork = `import asyncio
async def forgotten():
    await asyncio.sleep(60)
background = asyncio.create_task(forgotten())
print("Foreground finished")
`

describe('whole-run async cleanup', () => {
  it.each([null, 'service-validation', 'genai-async'])('contains learner-created tasks for %s', (exerciseId) => {
    expect(run(backgroundWork, exerciseId)).toMatchObject({ ok: true, pending: 0 })
  })

  it('cleans up background work even when the foreground source fails', () => {
    expect(run(`${backgroundWork}\nraise ValueError("Foreground failed")`, 'genai-async'))
      .toMatchObject({ ok: false, pending: 0 })
  })

  it('returns serializable behavior checks and no runtime namespace', () => {
    const result = run('print("ordinary Python")', null)
    expect(result).toMatchObject({ ok: true, pending: 0, serialized: expect.not.stringContaining('namespace') })
  })
})
