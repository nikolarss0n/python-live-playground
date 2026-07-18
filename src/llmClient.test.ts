import { describe, expect, it, vi } from 'vitest'
import { testLlmCompletion } from './llmClient'

describe('testLlmCompletion', () => {
  it('requires base URL and key', async () => {
    const a = await testLlmCompletion({
      baseUrl: '',
      apiKey: 'x',
      model: 'm',
    })
    expect(a.ok).toBe(false)
    const b = await testLlmCompletion({
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
      model: 'm',
    })
    expect(b.ok).toBe(false)
  })

  it('parses a successful chat completion', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          model: 'gpt-test',
          choices: [{ message: { content: 'Hello from the model.' } }],
        }),
    })
    const result = await testLlmCompletion({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('Hello')
      expect(result.model).toBe('gpt-test')
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer sk-test',
        }),
      }),
    )
  })
})
