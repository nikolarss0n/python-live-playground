import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { askLessonCoach } from './lessonCoach'
import { defaultSettings, SETTINGS_KEY } from './settings'

type CoachResult = Awaited<ReturnType<typeof askLessonCoach>>
const coach = vi.hoisted(() => ({ ask: vi.fn<() => Promise<CoachResult>>() }))

vi.mock('./lessonCoach', async (original) => ({
  ...await original<typeof import('./lessonCoach')>(),
  askLessonCoach: coach.ask,
}))
vi.mock('./components/CodeEditor', () => ({
  CodeEditor: ({ value, readOnly, onChange }: { value: string; readOnly: boolean; onChange: (value: string) => void }) => (
    <textarea aria-label="Python source" readOnly={readOnly} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('./execution/usePythonExecution', () => ({
  usePythonExecution: () => ({
    snapshot: { status: 'ready', events: [], durationMs: null, runId: null, error: null, executedCode: null, routes: [] },
    runNow: vi.fn(), stop: vi.fn(), isBooting: false, isRunning: false,
  }),
}))

function pendingReply() {
  let deliver: ((result: CoachResult) => void) | undefined
  const promise = new Promise<CoachResult>((resolve) => { deliver = resolve })
  return {
    promise,
    resolve(result: CoachResult) {
      if (!deliver) throw new Error('Missing deferred reply resolver')
      deliver(result)
    },
  }
}

describe('refresher AI isolation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('plp-section', 'python')
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...defaultSettings(), apiKey: 'unit-test-fixture', llmBaseUrl: 'https://example.invalid/v1',
    }))
    window.history.replaceState(null, '', '/?lesson=printing')
    coach.ask.mockReset()
  })

  it.each(['practice', 'mock'] as const)('drops a legacy coach reply that arrives after entering %s', async (destination) => {
    const reply = pendingReply()
    coach.ask.mockReturnValue(reply.promise)
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Ask about this lesson' }), 'Explain a loop{Enter}')
    expect(coach.ask).toHaveBeenCalledOnce()
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'interview')
    if (destination === 'mock') {
      await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'refresher-12')
      await user.click(screen.getByRole('button', { name: 'Start 60-minute mock' }))
    }
    expect(screen.queryByRole('textbox', { name: 'Ask about this lesson' })).not.toBeInTheDocument()
    await act(async () => {
      reply.resolve({ ok: true, text: 'Late AI answer from the previous lesson', model: 'fixture', durationMs: 1 })
      await reply.promise
    })
    expect(screen.queryByText('Late AI answer from the previous lesson')).not.toBeInTheDocument()
    expect(screen.queryByText('thinking…')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'python')
    if (destination === 'mock') {
      expect(screen.queryByRole('textbox', { name: 'Ask about this lesson' })).not.toBeInTheDocument()
      await user.selectOptions(screen.getByLabelText('Choose learning track'), 'interview')
      await user.click(screen.getByRole('button', { name: 'Submit attempt' }))
      await user.selectOptions(screen.getByLabelText('Choose learning track'), 'python')
    }
    expect(screen.getByRole('textbox', { name: 'Ask about this lesson' })).toBeInTheDocument()
    expect(screen.queryByText('Late AI answer from the previous lesson')).not.toBeInTheDocument()
    expect(coach.ask).toHaveBeenCalledOnce()
  })
})
