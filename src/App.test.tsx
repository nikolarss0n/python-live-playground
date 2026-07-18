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
      executedCode: null,
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
    const current = screen.getByLabelText(/current lesson/i)
    expect(current).toHaveTextContent(/Basics/i)
    expect(current).toHaveTextContent(/Beginner · Lesson 1 · Printing/i)
    expect(screen.getByRole('region', { name: /python editor/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /results/i })).toBeInTheDocument()
    const results = screen.getByRole('region', { name: /results/i })
    expect(results).toHaveTextContent('Hello, world!')
    expect(results).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
  })

  it('loads another lesson from the menu and shows its goal and tasks', async () => {
    const user = userEvent.setup()
    render(<App />)
    const goal = screen.getByRole('region', { name: /lesson goal/i })
    expect(goal).toHaveTextContent(/Make Python show two messages/i)
    expect(goal.querySelector('.lesson-tasks')).toBeTruthy()
    expect(goal.querySelector('.lesson-goal-statement')).toBeTruthy()
    expect(goal.querySelector('.lesson-goal-grid')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: /lesson path/i })).toBeTruthy()
    // Chapter + full heading live in the toolbar brand cluster
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Lesson 1 · Printing/i,
    )
    const select = screen.getByLabelText(/choose a lesson/i)
    await user.selectOptions(select, 'errors')
    expect(select).toHaveValue('errors')
    expect(goal).toHaveTextContent(/What does this mean/i)
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Lesson 13/i,
    )
  })

  it('shows a predict prompt on the first lesson', () => {
    render(<App />)
    expect(
      screen.getByRole('region', { name: /predict the output/i }),
    ).toBeInTheDocument()
  })

  it('exposes share, settings, and chapter context on the first lesson', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open settings/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(/Basics/i)
    const goal = screen.getByRole('region', { name: /lesson goal/i })
    expect(goal).toHaveTextContent(/Stretch/i)

    await user.click(screen.getByRole('button', { name: /open settings/i }))
    expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
  })

  it('switches difficulty to intermediate and loads its first lesson', async () => {
    const user = userEvent.setup()
    render(<App />)
    const difficulty = screen.getByLabelText(/choose difficulty/i)
    await user.selectOptions(difficulty, 'intermediate')
    expect(difficulty).toHaveValue('intermediate')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Intermediate · Lesson 1/i,
    )
    expect(screen.getByRole('region', { name: /lesson goal/i })).toBeTruthy()
    expect(screen.getByLabelText(/choose a lesson/i)).toHaveValue(
      'mid-enumerate-zip',
    )
  })

  it('switches to AI foundations and shows a pipeline strip', async () => {
    const user = userEvent.setup()
    render(<App />)
    const difficulty = screen.getByLabelText(/choose difficulty/i)
    await user.selectOptions(difficulty, 'ai')
    expect(difficulty).toHaveValue('ai')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /AI foundations · Lesson 1 · Tokens/i,
    )
    expect(screen.getByRole('list', { name: /pipeline stages/i })).toBeTruthy()
    expect(screen.getByLabelText(/choose a lesson/i)).toHaveValue('ai-tokens')
  })

  it('shows Run with model on AI lessons that support it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText(/choose difficulty/i), 'ai')
    // First AI lesson (tokens) now includes the bar + lesson default prompt
    expect(
      screen.getByRole('region', { name: /run with model/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /run with model/i }),
    ).toBeInTheDocument()
    // Mock execution already has prints → "From Results", else lesson default
    expect(screen.getByText(/from results|lesson default/i)).toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText(/choose a lesson/i),
      'ai-prompt-template',
    )
    expect(
      screen.getByRole('region', { name: /run with model/i }),
    ).toBeInTheDocument()
  })

  it('switches to Web APIs and loads the request lesson', async () => {
    const user = userEvent.setup()
    render(<App />)
    const difficulty = screen.getByLabelText(/choose difficulty/i)
    await user.selectOptions(difficulty, 'api')
    expect(difficulty).toHaveValue('api')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Web APIs · Lesson 1 · Request dict/i,
    )
    expect(screen.getByRole('region', { name: /lesson goal/i })).toHaveTextContent(
      /request dict/i,
    )
    expect(screen.getByLabelText(/choose a lesson/i)).toHaveValue('api-request')
    expect(screen.getByRole('region', { name: /local api/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /import openapi/i }),
    ).toBeInTheDocument()
  })

  it('toggles theme', async () => {
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('button', { name: /switch to dark theme/i })
    await user.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

