import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { LEARNING_STORAGE_KEY } from './learningStorage'
import { encodeSnapshot } from './shareSnapshot'

const runNow = vi.fn()
const latest: { autoRun?: boolean; untrustedCode?: string | null } = {}

vi.mock('./components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Python source" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

vi.mock('./execution/usePythonExecution', () => ({
  usePythonExecution: (_code: string, options: typeof latest) => {
    Object.assign(latest, options)
    return {
      snapshot: { status: 'ready' as const, events: [], durationMs: null, runId: null, error: null, executedCode: null, routes: [] },
      runNow,
      stop: vi.fn(),
      isBooting: false,
      isRunning: false,
    }
  },
}))

const openLink = () => window.history.replaceState(null, '', `/#${encodeSnapshot({ v: 1, lessonId: 'printing', difficulty: 'beginner', code: 'print("from a link")' })}`)

describe('opening a shared link', () => {
  beforeEach(() => {
    window.localStorage.clear()
    runNow.mockClear()
    window.history.replaceState(null, '', '/?lesson=printing')
  })

  it('waits for Run instead of executing the shared code', async () => {
    openLink()
    render(<App />)
    expect(latest.autoRun).toBe(false)
    expect(runNow).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Run it' }))
    expect(runNow).toHaveBeenCalledOnce()
  })

  it('still waits after a reload, when the link is gone from the address', () => {
    openLink()
    const { unmount } = render(<App />)
    unmount()
    expect(window.location.hash).toBe('')
    render(<App />)
    expect(latest.autoRun).toBe(false)
    expect(screen.getByRole('button', { name: 'Run it' })).toBeInTheDocument()
  })

  it('returns to automatic runs once the learner edits the code', async () => {
    openLink()
    render(<App />)
    await userEvent.type(screen.getByLabelText('Python source'), ' ')
    expect(latest.autoRun).toBe(true)
    expect(screen.queryByRole('button', { name: 'Run it' })).not.toBeInTheDocument()
  })

  it('says so when a shared link is left closed, and lets the notice be dismissed', async () => {
    const backups = Array.from({ length: 20 }, (_, index) => ({ code: `b${index}`, predictDone: false, verifiedCode: null }))
    window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify({
      version: 1, activeLessonId: 'printing', lastLessonByTrack: {},
      lessons: { printing: { code: 'print("my work")', predictDone: true, backups } },
    }))
    openLink()
    render(<App />)
    expect(screen.getByLabelText('Python source')).toHaveValue('print("my work")')
    expect(screen.getByText(/link not opened/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/link not opened/i)).not.toBeInTheDocument()
  })

  it('leaves ordinary lessons on automatic runs', () => {
    render(<App />)
    expect(latest.autoRun).toBe(true)
    expect(screen.queryByRole('button', { name: 'Run it' })).not.toBeInTheDocument()
  })
})
