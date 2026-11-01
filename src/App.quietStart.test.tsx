import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

vi.mock('./components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div role="region" aria-label="Python editor">
      <textarea aria-label="Python source" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  ),
}))

vi.mock('./execution/usePythonExecution', () => ({
  usePythonExecution: (code: string) => ({
    snapshot: {
      status: 'error' as const,
      events: [{ kind: 'error' as const, message: 'SyntaxError: invalid syntax', line: 6 }],
      durationMs: 3,
      runId: 'run-1',
      error: null,
      executedCode: code,
      routes: [],
    },
    runNow: vi.fn(),
    stop: vi.fn(),
    isBooting: false,
    isRunning: false,
  }),
}))

describe('untouched starter with blanks', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/?lesson=mid-enumerate-zip')
  })

  it('holds back the parse error until the first edit and offers a hint pill', async () => {
    render(<App />)
    const results = screen.getByRole('region', { name: /results/i })
    expect(results).not.toHaveTextContent('SyntaxError')
    expect(results).toHaveTextContent('Fill the 3 ??? blanks')
    expect(screen.getByRole('button', { name: /show a hint for the next blank \(3 blanks left\)/i })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Python source'), ' ')
    expect(results).toHaveTextContent('SyntaxError')
  })

  it('shows errors right away on a starter without blanks', () => {
    window.history.replaceState(null, '', '/?lesson=errors')
    render(<App />)
    expect(screen.getByRole('region', { name: /results/i })).toHaveTextContent('SyntaxError')
    expect(screen.queryByRole('button', { name: /show a hint/i })).not.toBeInTheDocument()
  })

  it('toggles the full solution without touching the code', async () => {
    const user = userEvent.setup()
    render(<App />)
    const source = screen.getByRole('textbox', { name: 'Python source' }) as HTMLTextAreaElement
    const before = source.value
    await user.click(screen.getByRole('button', { name: 'Solution' }))
    const card = screen.getByRole('region', { name: 'Full solution' })
    expect(card.querySelectorAll('mark')).toHaveLength(3)
    expect(card.textContent).toContain('start=1')
    expect(source.value).toBe(before)
    await user.click(screen.getByRole('button', { name: 'Hide solution' }))
    expect(screen.queryByRole('region', { name: 'Full solution' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Solution' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Full solution' })).toBeNull()
  })
})
