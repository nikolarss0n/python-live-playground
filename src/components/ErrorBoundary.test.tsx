import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function BrokenChild() {
  throw new Error('Private render details that must not reach the page')
}

afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('ErrorBoundary', () => {
  it('renders a healthy child normally', () => {
    render(<ErrorBoundary><p>The editor is ready</p></ErrorBoundary>)
    expect(screen.getByText('The editor is ready')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows recovery guidance without error details or changing saved data', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('saved-draft', 'print("kept")')
    render(<ErrorBoundary><BrokenChild /></ErrorBoundary>)
    const alert = screen.getByRole('alert')
    expect(screen.getByRole('main')).toContainElement(alert)
    expect(screen.getByRole('main')).not.toBe(alert)
    expect(within(alert).getByRole('heading', { name: 'This page stopped working' })).toBeVisible()
    expect(alert).toHaveTextContent('Reload the page to continue. Code and progress already saved on this device are kept.')
    expect(within(alert).getByRole('button', { name: 'Reload page' })).toBeVisible()
    expect(alert).not.toHaveTextContent('Private render details')
    expect(localStorage.getItem('saved-draft')).toBe('print("kept")')
  })

  it('calls the supplied reload function from its keyboard-accessible button', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    const user = userEvent.setup()
    render(<ErrorBoundary reload={reload}><BrokenChild /></ErrorBoundary>)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Reload page' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(reload).toHaveBeenCalledOnce()
  })
})
