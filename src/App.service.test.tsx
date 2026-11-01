import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { EXERCISE_CHECKS, type ExerciseId } from './serviceExercise'
import { loadLearningState, isLessonVerified } from './learningStorage'
import type { ExecutionStatus } from './execution/protocol'

const execution = vi.hoisted((): { source: string; exerciseId: string; status: ExecutionStatus } => ({
  source: '', exerciseId: '', status: 'success',
}))

vi.mock('./components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Python source" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('./execution/usePythonExecution', () => ({
  usePythonExecution: (_code: string, options: { exerciseId?: ExerciseId }) => ({
    snapshot: {
      status: execution.source ? execution.status : 'ready',
      events: [], durationMs: null, runId: execution.source || null, error: null,
      executedCode: execution.source || null, routes: [], exerciseId: execution.exerciseId || undefined,
      checks: options.exerciseId ? EXERCISE_CHECKS[options.exerciseId].map((check) => ({
        ...check, passed: true, detail: 'Passed',
      })) : [],
    },
    runNow: vi.fn(), stop: vi.fn(), isBooting: false, isRunning: false,
  }),
}))

function source(): string {
  const editor = screen.getByRole('textbox', { name: 'Python source' })
  if (!(editor instanceof HTMLTextAreaElement)) throw new Error('Missing editor')
  return editor.value
}

function edit(code: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Python source' }), { target: { value: code } })
}

describe('saved service learning flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('plp-section', 'python')
    window.history.replaceState(null, '', '/')
    execution.source = ''
    execution.exerciseId = ''
    execution.status = 'success'
  })
  afterEach(() => vi.restoreAllMocks())

  it('restarts a legacy lesson safely and restores its saved draft after reload', async () => {
    const user = userEvent.setup()
    const original = render(<App />)
    edit('print("Keep this work")')
    await user.click(screen.getByRole('button', { name: 'Show lesson', exact: false }))
    await user.click(screen.getByRole('button', { name: 'Restart exercise', exact: true }))
    expect(source()).not.toBe('print("Keep this work")')
    original.unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Restore previous draft', exact: true }))
    expect(source()).toBe('print("Keep this work")')
  })

  it('refuses to restart when the backup cannot be persisted', async () => {
    const user = userEvent.setup()
    render(<App />)
    edit('print("Unsaved backup must not replace this")')
    await user.click(screen.getByRole('button', { name: 'Show lesson', exact: false }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
    await user.click(screen.getByRole('button', { name: 'Restart exercise', exact: true }))
    expect(source()).toBe('print("Unsaved backup must not replace this")')
    expect(screen.getByText(/Restart cancelled because your backup could not be saved/)).toBeInTheDocument()
  })

  it('keeps separate drafts, resumes the last lesson, and restores after reload', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    edit('print("My saved draft")')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'variables')
    edit('name = "My own name"')
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'build')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'service-validation')
    edit('# My validation draft')
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'python')
    expect(screen.getByLabelText('Choose a lesson')).toHaveValue('variables')
    expect(screen.getByLabelText('Python source')).toHaveValue('name = "My own name"')
    first.unmount()
    render(<App />)
    expect(screen.getByLabelText('Choose a lesson')).toHaveValue('variables')
    expect(screen.getByLabelText('Python source')).toHaveValue('name = "My own name"')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'printing')
    expect(screen.getByLabelText('Python source')).toHaveValue('print("My saved draft")')
  })

  it('unlocks connected exercises only from fresh checks and carries the learner code', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'build')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'service-validation')
    expect(screen.getByRole('button', { name: /next lesson/i })).toBeDisabled()
    execution.source = 'def validate_question(payload):\n    return payload["question"].strip()\n# My implementation'
    execution.exerciseId = 'service-endpoint'
    edit(execution.source)
    expect(screen.getByRole('button', { name: /next lesson/i })).toBeDisabled()
    execution.exerciseId = 'service-validation'
    execution.source += '\n'
    edit(execution.source)
    expect(screen.getByRole('status', { name: 'Learning progress' })).toHaveTextContent('1/3 exercises complete')
    await user.click(screen.getByRole('button', { name: /next lesson/i }))
    expect(screen.getByLabelText('Choose a lesson')).toHaveValue('service-endpoint')
    expect(source()).toContain('# My implementation')
    expect(source()).toContain('@app.post("/ask")')
    expect(screen.getByRole('button', { name: /next lesson/i })).toBeDisabled()

    execution.source += '\n# Working endpoint'
    execution.exerciseId = 'service-endpoint'
    edit(execution.source)
    await user.click(screen.getByRole('button', { name: /next lesson/i }))
    expect(screen.getByLabelText('Choose a lesson')).toHaveValue('service-tests')
    expect(source()).toContain('# Working endpoint')
    expect(source()).toContain('def test_invalid_request():')

    edit('# My unfinished tests')
    await user.click(screen.getByRole('button', { name: /previous lesson/i }))
    await user.click(screen.getByRole('button', { name: /next lesson/i }))
    expect(screen.getByLabelText('Python source')).toHaveValue('# My unfinished tests')
  })

  it('persists completion across reload and removes it when verified code changes', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'build')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'service-validation')
    execution.source = '# Verified source'
    execution.exerciseId = 'service-validation'
    edit(execution.source)
    first.unmount()
    execution.source = ''
    render(<App />)
    expect(screen.getByLabelText('Python source')).toHaveValue('# Verified source')
    expect(screen.getByRole('status', { name: 'Learning progress' })).toHaveTextContent('1/3 exercises complete')
    edit('# Changed source')
    expect(screen.getByRole('status', { name: 'Learning progress' })).toHaveTextContent('0/3 exercises complete')
    expect(isLessonVerified(loadLearningState().state.lessons['service-validation'])).toBe(false)
    expect(screen.getByRole('button', { name: /next lesson/i })).toBeDisabled()
  })

  it('redirects a fresh deep link to the first prerequisite', () => {
    window.history.replaceState(null, '', '/?lesson=service-tests')
    render(<App />)
    expect(screen.getByLabelText('Choose a lesson')).toHaveValue('service-validation')
  })

  it.each(['error', 'timeout', 'stopped'] as const)('clears a previous success after a same-code %s', async (status) => {
    const user = userEvent.setup()
    const app = render(<App />)
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'build')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'service-validation')
    execution.source = '# Previously verified code'
    execution.exerciseId = 'service-validation'
    edit(execution.source)
    expect(screen.getByRole('button', { name: /next lesson/i })).toBeEnabled()
    execution.status = status
    app.rerender(<App />)
    expect(screen.getByRole('status', { name: 'Learning progress' })).toHaveTextContent('0/3 exercises complete')
    expect(screen.getByRole('button', { name: /next lesson/i })).toBeDisabled()
  })

  it('keeps editing usable and reports unavailable storage honestly', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage denied') })
    render(<App />)
    edit('print("Still editable")')
    expect(screen.getByLabelText('Python source')).toHaveValue('print("Still editable")')
    expect(screen.getByRole('status', { name: 'Learning progress' })).toHaveTextContent('Not saved: browser storage is unavailable')
  })

  it('still opens when the browser denies localStorage access', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Storage denied') })
    render(<App />)
    expect(screen.getByRole('textbox', { name: 'Python source' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Learning progress' })).toHaveTextContent('Not saved')
  })

  it('offers the Python GenAI path, saves its progress, and keeps the real lab in lesson details', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'build')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'genai-typed')
    expect(screen.getByLabelText('Choose a lesson')).toHaveValue('genai-typed')
    expect(screen.queryByRole('link', { name: 'Download local AWS lab' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show lesson' }))
    expect(screen.getByRole('link', { name: 'Download local AWS lab' })).toHaveAttribute('href', '/labs/aws-genai.zip')
    expect(screen.getByRole('group', { name: 'Lesson details' })).toHaveTextContent('live AWS calls are opt-in')
    execution.source = '# Verified typed request'
    execution.exerciseId = 'genai-typed'
    edit(execution.source)
    expect(screen.getByRole('status', { name: 'Learning progress' })).toHaveTextContent('1/10 exercises complete')
    expect(screen.getByRole('status', { name: 'Task evidence' })).toHaveTextContent('practice, not production experience')
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'build')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'service-validation')
    await user.selectOptions(screen.getByLabelText('Choose learning track'), 'build')
    await user.selectOptions(screen.getByLabelText('Choose a lesson'), 'genai-typed')
    expect(screen.getByLabelText('Python source')).toHaveValue('# Verified typed request')
  })
})
