import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  usePythonExecution: (code: string) => ({
    snapshot: {
      status: 'success' as const,
      events: [
        { kind: 'print' as const, text: 'Hello, world!', line: 5 },
        { kind: 'expr' as const, value: '4', line: 7 },
      ],
      durationMs: 12,
      runId: 'run-1',
      error: null,
      executedCode: code,
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
    window.localStorage.setItem('plp-section', 'python')
    window.history.replaceState(null, '', '/')
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
    expect(current).toHaveTextContent(/First steps/i)
    expect(current).toHaveTextContent(/Learn Python · Lesson 1 · Printing/i)
    expect(screen.getByRole('region', { name: /python editor/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /results/i })).toBeInTheDocument()
    const results = screen.getByRole('region', { name: /results/i })
    expect(results).toHaveTextContent('Hello, world!')
    expect(results).toHaveTextContent('4')
    expect(
      screen.queryByRole('group', { name: /simulated api routes/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /call /i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: /lesson navigation/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /previous lesson/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /next lesson/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /ask about this lesson/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show lesson/i }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('group', { name: /lesson details/i }),
    ).not.toBeInTheDocument()
  })

  it('loads another lesson from the menu and shows its goal and tasks', async () => {
    const user = userEvent.setup()
    render(<App />)
    const goal = screen.getByRole('region', { name: /lesson goal/i })
    expect(goal).toHaveTextContent(/Make Python show two messages/i)
    await user.click(screen.getByRole('button', { name: /show lesson/i }))
    expect(goal).toHaveTextContent(/Why it matters/i)
    expect(goal).toHaveTextContent(/fastest way to inspect/i)
    expect(goal.querySelector('.lesson-tasks')).toBeTruthy()
    expect(goal.querySelectorAll('.lesson-task-instruction')).toHaveLength(2)
    expect(goal).toHaveTextContent(/Edit the text inside the first print/i)
    expect(goal).toHaveTextContent(/Replace \?\?\? in the second print/i)
    expect(goal.querySelector('.lesson-goal-statement')).toBeTruthy()
    expect(goal.querySelector('.lesson-goal-grid')).toBeTruthy()
    // Chapter + full heading live in the toolbar lesson cluster
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Lesson 1 · Printing/i,
    )
    const select = screen.getByLabelText(/choose a lesson/i)
    await user.selectOptions(select, 'errors')
    expect(select).toHaveValue('errors')
    expect(goal).toHaveTextContent(/What does this mean/i)
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Lesson 19/i,
    )
  })

  it('moves between lessons with Prev and Next', async () => {
    const user = userEvent.setup()
    render(<App />)
    const select = screen.getByLabelText(/choose a lesson/i)
    expect(select).toHaveValue('printing')

    const prev = screen.getByRole('button', { name: /previous lesson/i })
    const next = screen.getByRole('button', { name: /next lesson/i })
    // First lesson: Prev disabled, Next enabled
    expect(prev).toBeDisabled()
    expect(next).toBeEnabled()

    await user.click(next)
    expect(select).not.toHaveValue('printing')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Lesson 2/i,
    )

    expect(
      screen.getByRole('button', { name: /previous lesson/i }),
    ).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /previous lesson/i }))
    expect(select).toHaveValue('printing')
  })

  it('does not show the predict prompt', () => {
    render(<App />)
    expect(screen.queryByRole('region', { name: /predict the output/i })).toBeNull()
  })

  it('shows post-run goal checks in Results for the default printing lesson', async () => {
    render(<App />)
    const results = screen.getByRole('region', { name: /results/i })
    const checks = screen.getByRole('region', { name: /goal checks/i })
    expect(results.contains(checks)).toBe(true)
    expect(checks).toHaveTextContent(/greets you by name/)
    await waitFor(() => expect(checks).toHaveTextContent(/0\/3 passed/))
  })

  it('exposes settings and chapter context on the first lesson', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(
      screen.getByRole('button', { name: /open settings/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(/First steps/i)
    const goal = screen.getByRole('region', { name: /lesson goal/i })
    await user.click(screen.getByRole('button', { name: /show lesson/i }))
    expect(goal).toHaveTextContent(/Stretch/i)

    await user.click(screen.getByRole('button', { name: /open settings/i }))
    expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
  })

  it('continues Learn Python into the deeper lessons and switches to Interview prep', async () => {
    const user = userEvent.setup()
    render(<App />)
    const section = screen.getByLabelText(/choose learning track/i)
    expect(section).toHaveValue('python')
    await user.selectOptions(screen.getByLabelText(/choose a lesson/i), 'mid-enumerate-zip')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Sequences & comprehensions.*Learn Python · Lesson 33 · Enumerate/i,
    )
    await user.selectOptions(section, 'interview')
    expect(section).toHaveValue('interview')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(/Interview prep · Day 1/i)
    expect(screen.getByLabelText(/choose a lesson/i)).toHaveValue('refresher-01')
  })

  it('switches to Machine learning & LLMs and shows a pipeline strip', async () => {
    const user = userEvent.setup()
    render(<App />)
    const difficulty = screen.getByLabelText(/choose learning track/i)
    await user.selectOptions(difficulty, 'ml')
    expect(difficulty).toHaveValue('ml')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Machine learning & LLMs · Lesson 1 · Tokens/i,
    )
    await user.click(screen.getByRole('button', { name: /show lesson/i }))
    expect(screen.getByRole('list', { name: /pipeline stages/i })).toBeTruthy()
    expect(screen.getByLabelText(/choose a lesson/i)).toHaveValue('ai-tokens')
  })

  it('opens the expanded Python and AI study-book topics', async () => {
    const user = userEvent.setup()
    render(<App />)

    const difficulty = screen.getByLabelText(/choose learning track/i)
    const lesson = screen.getByLabelText(/choose a lesson/i)
    const goal = screen.getByRole('region', { name: /lesson goal/i })
    await user.click(screen.getByRole('button', { name: /show lesson/i }))

    await user.selectOptions(lesson, 'mid-generators')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Idiomatic Python.*Lesson 48.*Generators/i,
    )
    expect(goal).toHaveTextContent(/Yield even squares lazily/i)
    expect(goal).toHaveTextContent(/memory nearly flat/i)

    await user.selectOptions(difficulty, 'ml')
    await user.selectOptions(lesson, 'ai-retrieval')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Retrieval, evals & tools.*Lesson 14.*Retrieval & top-k/i,
    )
    expect(goal).toHaveTextContent(/abstain when evidence is weak/i)
  })

  it('shows Run with model on AI lessons that support it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText(/choose learning track/i), 'ml')
    // Advanced model controls stay out of sight with the lesson details.
    expect(
      screen.queryByRole('region', { name: /run with model/i }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /show lesson/i }))
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
    // Choosing another lesson is a click outside the lesson popover, which closes it.
    await user.click(screen.getByRole('button', { name: /show lesson/i }))
    expect(
      screen.getByRole('region', { name: /run with model/i }),
    ).toBeInTheDocument()
  })

  it('remembers the lesson detail preference across app visits', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: /show lesson/i }))
    expect(
      screen.getByRole('button', { name: /hide lesson/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(window.localStorage.getItem('plp-lesson-details-open')).toBe('1')

    unmount()
    render(<App />)
    expect(
      screen.getByRole('button', { name: /hide lesson/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('group', { name: /lesson details/i }),
    ).toBeInTheDocument()
  })

  it('switches to Build AI services and loads the request lesson', async () => {
    const user = userEvent.setup()
    render(<App />)
    const difficulty = screen.getByLabelText(/choose learning track/i)
    await user.selectOptions(difficulty, 'build')
    expect(difficulty).toHaveValue('build')
    expect(screen.getByLabelText(/current lesson/i)).toHaveTextContent(
      /Build AI services · Lesson 1 · Request dict/i,
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

  it('orders header groups: lesson, navigation, then utilities, with a hidden page heading', () => {
    render(<App />)
    const header = document.querySelector('header.toolbar')
    expect(header).toBeTruthy()

    const heading = screen.getByRole('heading', { level: 1, name: 'Python Live' })
    const lesson = screen.getByLabelText(/current lesson/i)
    const nav = screen.getByRole('group', { name: /lesson navigation/i })
    const utilities = screen.getByRole('group', { name: /utilities/i })

    expect(heading).toHaveClass('sr-only')
    expect(header!.querySelector('.brand-mark')).toBeNull()

    const precedes = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(precedes(heading, lesson)).toBe(true)
    expect(precedes(lesson, nav)).toBe(true)
    expect(precedes(nav, utilities)).toBe(true)

    // Navigation cluster holds track, lesson chooser, and adjacent Prev/Next
    const track = screen.getByLabelText(/choose learning track/i)
    const lessonSelect = screen.getByLabelText(/choose a lesson/i)
    const prev = screen.getByRole('button', { name: /previous lesson/i })
    const next = screen.getByRole('button', { name: /next lesson/i })
    expect(nav.contains(track)).toBe(true)
    expect(nav.contains(lessonSelect)).toBe(true)
    expect(nav.contains(prev)).toBe(true)
    expect(nav.contains(next)).toBe(true)
    expect(precedes(track, lessonSelect)).toBe(true)
    expect(precedes(lessonSelect, prev)).toBe(true)
    expect(precedes(prev, next)).toBe(true)

    // Utilities cluster holds settings and theme — after navigation, not interleaved
    const settings = screen.getByRole('button', { name: /open settings/i })
    const theme = screen.getByRole('button', { name: /switch to (dark|light) theme/i })
    expect(utilities.contains(settings)).toBe(true)
    expect(utilities.contains(theme)).toBe(true)
    expect(precedes(next, settings)).toBe(true)
    expect(precedes(settings, theme)).toBe(true)
  })
})
