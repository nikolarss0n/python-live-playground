import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GoalChecks } from '../components/GoalChecks'
import { JevPill } from './JevPill'
import type { JevPinpointState } from './useJevPinpoint'

const pinpoint = { line: 4, from: 2, to: 7, mistake: 'missing_closing' as const, message: 'Add `)`.', confidence: 1 }
const shown = (state: Exclude<JevPinpointState, { status: 'off' }>) => {
  const { container } = render(<JevPill state={state} onRecheck={vi.fn()} onShow={vi.fn()} />)
  const element = container.firstElementChild
  return [element?.textContent, element?.getAttribute('aria-label'), element?.getAttribute('title')].join(' ')
}

describe('names shown to learners', () => {
  it('never names the service behind the problem chip', () => {
    expect(shown({ status: 'checking' })).toContain('Finding the problem…')
    expect(shown({ status: 'failed', message: 'The AI check did not answer in time.' })).toContain('Retry finding the problem')
    expect(shown({ status: 'found', pinpoint, source: 'AI' })).toContain('Problem · line 4')
    expect(shown({ status: 'found', pinpoint, source: 'Fix' })).toContain('Problem · line 4')
    const labels = [...document.querySelectorAll('[aria-label], [title]')].map((element) => `${element.getAttribute('aria-label')} ${element.getAttribute('title')}`)
    expect(`${document.body.textContent} ${labels.join(' ')}`).not.toMatch(/jev/i)
  })

  it('never names the service in the goal-check header', () => {
    const rows = [{ id: 'goal', label: 'Two messages', status: 'checking' as const, note: null, isGoal: true }]
    render(<GoalChecks checks={{ source: 'Jev', passed: 0, rows }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking…')
    expect(document.body.textContent).not.toMatch(/jev/i)
  })
})
