import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { ResultEvent } from './execution/protocol'
import App from './App'

vi.mock('./components/CodeEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (v: string) => void
  }) => (
    <div role="region" aria-label="Python editor">
      <textarea
        aria-label="Python source"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}))

vi.mock('./execution/usePythonExecution', () => ({
  usePythonExecution: () => {
    const [events, setEvents] = useState<ResultEvent[]>([
      { kind: 'print', text: 'ready', line: 1 },
    ])
    return {
      snapshot: {
        status: 'success' as const,
        events,
        durationMs: 8,
        runId: 'run-1',
        error: null,
        executedCode: 'from fastapi import FastAPI\napp = FastAPI()',
        routes: [
          { method: 'GET', path: '/hello', callPath: '/hello' },
        ],
      },
      runNow: vi.fn(),
      stop: vi.fn(),
      invoke: vi.fn(async () => {
        setEvents((prev) => [
          ...prev,
          {
            kind: 'http',
            method: 'GET',
            path: '/hello',
            status: 200,
            body: '{"message":"hi"}',
            simulated: true,
          },
        ])
      }),
      isBooting: false,
      isRunning: false,
    }
  },
}))

describe('App simulated FastAPI results', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('plp-section', 'python')
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not show the Call strip above HTTP results', () => {
    render(<App />)
    const results = screen.getByRole('region', { name: /results/i })
    expect(results).toHaveTextContent('ready')
    expect(
      screen.queryByRole('group', { name: /simulated api routes/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /call /i }),
    ).not.toBeInTheDocument()
  })
})
