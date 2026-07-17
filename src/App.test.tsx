import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  usePythonExecution: () => ({
    snapshot: {
      status: 'ready' as const,
      events: [
        { kind: 'print' as const, text: 'Hello, world!', line: 5 },
        { kind: 'expr' as const, value: '4', line: 7 },
      ],
      durationMs: 12,
      runId: 'run-1',
      error: null,
    },
    runNow: vi.fn(),
    stop: vi.fn(),
    isBooting: false,
    isRunning: false,
  }),
}))

describe('App beginner flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the playground chrome and default example output', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /python live/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /python editor/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /results/i })).toBeInTheDocument()
    expect(screen.getByText('Hello, world!')).toBeInTheDocument()
    const results = screen.getByRole('region', { name: /results/i })
    expect(results).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
  })

  it('loads another example from the menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    const select = screen.getByLabelText(/load an example/i)
    await user.selectOptions(select, 'errors')
    expect(select).toHaveValue('errors')
    // Errors example includes a / b division
    expect(screen.getByRole('region', { name: /python editor/i })).toBeInTheDocument()
  })

  it('toggles theme', async () => {
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('button', { name: /switch to dark theme/i })
    await user.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
