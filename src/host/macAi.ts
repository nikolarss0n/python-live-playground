/**
 * AI checks in the macOS app. The page keeps building the same `{ state, questions }` requests it sends to the
 * dev server; this transport hands them to Swift, which answers with Apple's on-device model
 * (`macos/Sources/PlaygroundAI`). Questions and choices travel as ordered lists, so the model sees candidate lines
 * in source order.
 */

import { JEV_ROUTE } from '../jev/forward'

export const AI_HANDLER = 'playgroundAI'

export type OrderedChoiceRequest = {
  state: Record<string, unknown>
  questions: { id: string; instructions: string; choices: { id: string; description: string }[] }[]
}

type ReplyHandler = { postMessage: (message: unknown) => Promise<unknown> }
type AiWindow = Window & { webkit?: { messageHandlers?: Record<string, ReplyHandler | undefined> } }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `{ state, questions: { id: { instructions, criteria: { choice: description } } } }` → ordered lists. */
export function toOrderedChoiceRequest(body: unknown): OrderedChoiceRequest | null {
  if (!isRecord(body) || !isRecord(body.state) || !isRecord(body.questions)) return null
  const questions: OrderedChoiceRequest['questions'] = []
  for (const [id, question] of Object.entries(body.questions)) {
    if (!isRecord(question) || question.type !== 'choice' || typeof question.instructions !== 'string' || !isRecord(question.criteria)) return null
    const choices = Object.entries(question.criteria).map(([choice, description]) => ({ id: choice, description: String(description) }))
    if (!choices.length) return null
    questions.push({ id, instructions: question.instructions, choices })
  }
  return questions.length ? { state: body.state, questions } : null
}

export function hasMacAi(win: Window = window): boolean {
  return Boolean((win as AiWindow).webkit?.messageHandlers?.[AI_HANDLER])
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A fetch for `JEV_ROUTE` only: GET says whether the model is ready, POST asks it. */
export function macAiFetch(win: Window = window): typeof fetch {
  return async (input, init) => {
    const handler = (win as AiWindow).webkit?.messageHandlers?.[AI_HANDLER]
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!handler || !url.endsWith(JEV_ROUTE)) return json({ error: 'Not found' }, 404)
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if ((init?.method ?? 'GET').toUpperCase() === 'GET') {
      const reply = await handler.postMessage({ type: 'availability' }).catch(() => null)
      return json({ configured: isRecord(reply) && reply.available === true })
    }
    let request: OrderedChoiceRequest | null = null
    try { request = toOrderedChoiceRequest(JSON.parse(String(init?.body ?? ''))) } catch { request = null }
    if (!request) return json({ error: 'The AI request is not valid.' }, 400)
    const asked = handler.postMessage({ type: 'answer', request })
    const aborted = new Promise<never>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
    try {
      const reply = await Promise.race([asked, aborted])
      return isRecord(reply) && isRecord(reply.answers) ? json({ answers: reply.answers }) : json({ error: 'No answer' }, 502)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return json({ error: 'The on-device model could not answer.' }, 503)
    }
  }
}
