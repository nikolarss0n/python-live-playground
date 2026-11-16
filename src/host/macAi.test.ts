import { afterEach, describe, expect, it, vi } from 'vitest'
import { JEV_ROUTE } from '../jev/forward'
import { buildPinpointRequest, candidatesFor } from '../jev/pinpoint'
import { hasMacAi, macAiFetch, toOrderedChoiceRequest } from './macAi'

const install = (postMessage: (message: unknown) => Promise<unknown>) => {
  ;(window as unknown as { webkit: unknown }).webkit = { messageHandlers: { playgroundAI: { postMessage } } }
}

afterEach(() => { delete (window as unknown as { webkit?: unknown }).webkit })

describe('on-device AI transport', () => {
  it('keeps questions and choices in the order the page built them', () => {
    const code = 'total = sum([1, 2, 3]\nprint(total)\n'
    const candidates = candidatesFor(code, 1)
    const request = toOrderedChoiceRequest(buildPinpointRequest(code, { message: "SyntaxError: '(' was never closed", line: 1 }, candidates))
    expect(request?.questions.map((question) => question.id)).toEqual(['location', 'mistake'])
    expect(request?.questions[0].choices.map((choice) => choice.id)).toEqual(candidates.map((candidate) => candidate.id))
    expect(request?.state.code).toContain('1 | total = sum([1, 2, 3]')
  })

  it('refuses anything that is not a choice request', () => {
    expect(toOrderedChoiceRequest({ state: {}, questions: { q: { type: 'text', instructions: 'x', criteria: { a: 'b' } } } })).toBeNull()
    expect(toOrderedChoiceRequest({ state: {}, questions: {} })).toBeNull()
    expect(toOrderedChoiceRequest('nope')).toBeNull()
  })

  it('answers the availability check and asks Swift with the ordered request', async () => {
    const postMessage = vi.fn(async (message: unknown) => {
      const type = (message as { type: string }).type
      return type === 'availability' ? { available: true } : { answers: { q: { type: 'choice', choice: 'a', confidence: 0.8 } } }
    })
    install(postMessage)
    expect(hasMacAi()).toBe(true)
    const ask = macAiFetch()
    expect(await (await ask(JEV_ROUTE)).json()).toEqual({ configured: true })
    const response = await ask(JEV_ROUTE, { method: 'POST', body: JSON.stringify({ state: { code: 'x' }, questions: { q: { type: 'choice', instructions: 'Pick', criteria: { a: 'first', b: 'second' } } } }) })
    expect(await response.json()).toEqual({ answers: { q: { type: 'choice', choice: 'a', confidence: 0.8 } } })
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'answer', request: { state: { code: 'x' }, questions: [{ id: 'q', instructions: 'Pick', choices: [{ id: 'a', description: 'first' }, { id: 'b', description: 'second' }] }] } })
  })

  it('reports an unavailable model and a failed answer without throwing', async () => {
    install(async (message) => {
      if ((message as { type: string }).type === 'availability') return { available: false }
      throw new Error('Model busy')
    })
    const ask = macAiFetch()
    expect(await (await ask(JEV_ROUTE)).json()).toEqual({ configured: false })
    const response = await ask(JEV_ROUTE, { method: 'POST', body: JSON.stringify({ state: {}, questions: { q: { type: 'choice', instructions: 'Pick', criteria: { a: 'x' } } } }) })
    expect(response.status).toBe(503)
    expect((await ask('/other')).status).toBe(404)
  })

  it('stops waiting when the check is cancelled', async () => {
    install(() => new Promise(() => {}))
    const controller = new AbortController()
    const pending = macAiFetch()(JEV_ROUTE, { method: 'POST', signal: controller.signal, body: JSON.stringify({ state: {}, questions: { q: { type: 'choice', instructions: 'Pick', criteria: { a: 'x' } } } }) })
    controller.abort()
    await expect(pending).rejects.toThrow('Aborted')
  })
})
