import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { LEARNING_SWITCHES_KEY, readEnabledSections } from './learningSwitches'

vi.mock('./execution/usePythonExecution', () => ({
  usePythonExecution: (code: string) => ({
    snapshot: { status: 'success' as const, events: [], durationMs: 1, runId: 'run-1', error: null, executedCode: code, routes: [] },
    runNow: vi.fn(),
    stop: vi.fn(),
    isBooting: false,
    isRunning: false,
  }),
}))

describe('learning switches', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('opens as a plain Python editor with every learning section off', async () => {
    render(<App />)
    expect(screen.queryByRole('combobox', { name: 'Choose learning track' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Lesson navigation' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    const switches = screen.getAllByRole('switch')
    expect(switches.length).toBeGreaterThanOrEqual(8)
    for (const control of switches) expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('adds a section to the track menu when its switch turns on, and removes it again', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Interview prep' }))
    expect(screen.getByRole('switch', { name: 'Interview prep' })).toHaveAttribute('aria-checked', 'true')
    expect(readEnabledSections()).toEqual(new Set(['interview']))
    const menu = await screen.findByRole('combobox', { name: 'Choose learning track' })
    expect(menu).toHaveValue('interview')
    expect([...menu.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Interview prep'])

    await userEvent.click(screen.getByRole('switch', { name: 'Interview prep' }))
    expect(window.localStorage.getItem(LEARNING_SWITCHES_KEY)).toBe('[]')
    expect(screen.queryByRole('combobox', { name: 'Choose learning track' })).not.toBeInTheDocument()
  })

  it('moves to another switched-on section when the current one turns off', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Playground' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Learn Python' }))
    expect(await screen.findByRole('combobox', { name: 'Choose learning track' })).toHaveValue('playground')
    await userEvent.click(screen.getByRole('switch', { name: 'Playground' }))
    expect(screen.getByRole('combobox', { name: 'Choose learning track' })).toHaveValue('python')
  })
})
