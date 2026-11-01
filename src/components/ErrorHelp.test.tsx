import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorHelp, type ErrorHelpContext } from './ErrorHelp'
import type { askErrorAdvice, ErrorAdviceResult } from '../errorAdvice'

const advice = vi.hoisted(() => ({ ask: vi.fn<typeof askErrorAdvice>() }))
vi.mock('../errorAdvice', async (original) => ({
  ...await original<typeof import('../errorAdvice')>(), askErrorAdvice: advice.ask,
}))
const error = { kind: 'error' as const, message: 'SyntaxError: invalid syntax', friendly: '', traceback: '', line: 2 }
const context: ErrorHelpContext = {
  code: 'password = "do-not-send"\nfunction sumy(a, b):\n    print(a + b)',
  contextId: 'refresher-01/recall/run-1', lessonTitle: 'Basic syntax',
  settings: { apiKey: 'synthetic-key', llmBaseUrl: 'https://example.invalid/v1', llmModel: 'fixture' },
  allowed: true, fresh: true, onOpenSettings: vi.fn(),
}
const result: ErrorAdviceResult = {
  ok: true, advice: { explanation: 'Python functions start with def.', hint: 'Change the function keyword.', example: 'def sumy(a, b):\n    print(a + b)' },
  context: { snippet: '', startLine: 1, endLine: 3, error: { message: error.message, line: 2 }, truncated: false, redacted: true, contextNote: '' },
  durationMs: 2,
}

describe('optional error help', () => {
  beforeEach(() => { advice.ask.mockReset(); vi.clearAllMocks() })

  it('previews bounded redacted context and only asks after an explicit request', async () => {
    const user = userEvent.setup()
    advice.ask.mockResolvedValue(result)
    render(<ErrorHelp error={error} context={context} />)
    expect(advice.ask).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'AI error help' }))
    await user.click(screen.getByText('Snippet and error to send'))
    expect(screen.queryByText(/do-not-send/)).not.toBeInTheDocument()
    expect(screen.getByText(/\[REDACTED\]/)).toBeInTheDocument()
    expect(advice.ask).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Ask for a hint' }))
    expect(advice.ask).toHaveBeenCalledOnce()
    expect(screen.getByRole('status', { name: 'AI error suggestion' })).toHaveTextContent('Python functions start with def.')
    expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument()
  })

  it('hands the answer to the editor as code when an editor target exists', async () => {
    const user = userEvent.setup()
    const onSuggest = vi.fn()
    advice.ask.mockResolvedValue(result)
    render(<ErrorHelp error={error} context={{ ...context, onSuggest }} />)
    await user.click(screen.getByRole('button', { name: 'AI error help' }))
    await user.click(screen.getByRole('button', { name: 'Ask for a hint' }))
    expect(onSuggest).toHaveBeenCalledWith(result.ok ? result.advice : null, 2)
    expect(screen.getByRole('status', { name: 'AI error suggestion' })).toHaveTextContent('Suggestion shown in the editor under line 2.')
    expect(screen.queryByText('Python functions start with def.')).not.toBeInTheDocument()
  })

  it('offers configuration without sending anything when a model is not configured', async () => {
    const user = userEvent.setup()
    render(<ErrorHelp error={error} context={{ ...context, settings: { ...context.settings, apiKey: '' } }} />)
    await user.click(screen.getByRole('button', { name: 'AI error help' }))
    await user.click(screen.getByRole('button', { name: 'Configure AI help' }))
    expect(context.onOpenSettings).toHaveBeenCalledOnce()
    expect(advice.ask).not.toHaveBeenCalled()
  })

  it('does not expose AI controls when assistance is forbidden', () => {
    render(<ErrorHelp error={error} context={{ ...context, allowed: false }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(advice.ask).not.toHaveBeenCalled()
  })

  it.each(['edit', 'blocked', 'phase'] as const)('aborts and ignores a late response after %s', async (change) => {
    let resolve: ((value: ErrorAdviceResult) => void) | undefined
    advice.ask.mockImplementation(() => new Promise((deliver) => { resolve = deliver }))
    const user = userEvent.setup()
    const view = render(<ErrorHelp error={error} context={context} />)
    await user.click(screen.getByRole('button', { name: 'AI error help' }))
    await user.click(screen.getByRole('button', { name: 'Ask for a hint' }))
    const signal = advice.ask.mock.calls[0]?.[0].signal
    view.rerender(<ErrorHelp error={error} context={{ ...context,
      code: change === 'edit' ? 'changed source' : context.code,
      allowed: change !== 'blocked', contextId: change === 'phase' ? 'new-phase' : context.contextId,
    }} />)
    expect(signal?.aborted).toBe(true)
    await act(async () => { resolve?.(result); await Promise.resolve() })
    expect(screen.queryByRole('status', { name: 'AI error suggestion' })).not.toBeInTheDocument()
  })

  it('requires a fresh error before sending a hint request', async () => {
    const user = userEvent.setup()
    render(<ErrorHelp error={error} context={{ ...context, fresh: false }} />)
    await user.click(screen.getByRole('button', { name: 'AI error help' }))
    expect(screen.queryByRole('button', { name: 'Ask for a hint' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Run the current code')
    expect(advice.ask).not.toHaveBeenCalled()
  })
})
