/**
 * Server-side Jev forwarding used by the Vite dev/preview middleware.
 * The TypeSafe key is read from the server environment and never reaches the browser.
 */

/** Same-origin route served by the Vite dev/preview middleware. */
export const JEV_ROUTE = '/api/jev/systemone'
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
export const JEV_MAX_REQUEST_BYTES = 24_000
const MAX_RESPONSE_BYTES = 64_000
const TIMEOUT_MS = 15_000

export type JevForwardConfig = {
  apiKey: string
  model: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}
export type JevForwardResult = { status: number; body: string }

const failure = (status: number, error: string): JevForwardResult => ({ status, body: JSON.stringify({ error }) })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Forward one `{ state, questions }` request with the configured model and key; errors stay generic. */
export async function forwardJev(rawBody: string, config: JevForwardConfig): Promise<JevForwardResult> {
  if (!config.apiKey.trim()) return failure(503, 'Jev is not configured. Set TYPESAFE_API_KEY in .env.local and restart the dev server.')
  if (new TextEncoder().encode(rawBody).byteLength > JEV_MAX_REQUEST_BYTES) return failure(413, 'The Jev request is too large.')
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return failure(400, 'The Jev request is not valid JSON.') }
  if (!isRecord(parsed) || !isRecord(parsed.questions) || Object.keys(parsed).some((key) => key !== 'state' && key !== 'questions')) {
    return failure(400, 'The Jev request must contain only state and questions.')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? TIMEOUT_MS)
  try {
    const response = await (config.fetchImpl ?? fetch)(JEV_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey.trim()}` },
      body: JSON.stringify({ model: config.model.trim() || 'jev-latest', state: parsed.state, questions: parsed.questions }),
      signal: controller.signal,
      redirect: 'error',
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      return failure(502, `Jev rejected the request (${response.status}).`)
    }
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) return failure(502, 'The Jev response was too large.')
    return { status: 200, body: text }
  } catch {
    return failure(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'Jev did not answer in time.' : 'Jev could not be reached.')
  } finally {
    clearTimeout(timer)
  }
}
