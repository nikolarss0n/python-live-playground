/**
 * Quiet one-shot OpenAI-compatible chat completion (browser → provider).
 * Key never leaves the browser except to the URL the learner configured.
 */

export type LlmTestResult =
  | { ok: true; text: string; model: string; durationMs: number }
  | { ok: false; error: string; durationMs: number }

export async function testLlmCompletion(opts: {
  baseUrl: string
  apiKey: string
  model: string
  prompt?: string
  fetchImpl?: typeof fetch
}): Promise<LlmTestResult> {
  const started = performance.now()
  const base = opts.baseUrl.replace(/\/$/, '')
  const key = opts.apiKey.trim()
  if (!base) {
    return {
      ok: false,
      error: 'Set an LLM base URL in Settings (OpenAI-compatible).',
      durationMs: 0,
    }
  }
  if (!key) {
    return {
      ok: false,
      error: 'Set an API key in Settings.',
      durationMs: 0,
    }
  }

  const fetchImpl = opts.fetchImpl ?? fetch
  const prompt =
    opts.prompt?.trim() ||
    'Reply with exactly one short sentence: Python is great for learning.'

  try {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.2,
      }),
    })
    const raw = await res.text()
    if (!res.ok) {
      let detail = raw.slice(0, 240)
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } }
        if (j.error?.message) detail = j.error.message
      } catch {
        // keep raw
      }
      return {
        ok: false,
        error: `${res.status}: ${detail}`,
        durationMs: Math.round(performance.now() - started),
      }
    }
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
      model?: string
    }
    const text = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) {
      return {
        ok: false,
        error: 'Empty model response.',
        durationMs: Math.round(performance.now() - started),
      }
    }
    return {
      ok: true,
      text,
      model: data.model ?? opts.model,
      durationMs: Math.round(performance.now() - started),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: /Failed to fetch|NetworkError/i.test(message)
        ? 'Network error — check base URL, CORS, and the key.'
        : message,
      durationMs: Math.round(performance.now() - started),
    }
  }
}
