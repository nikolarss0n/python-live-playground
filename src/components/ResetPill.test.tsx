import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResetPill } from './ResetPill'

describe('ResetPill', () => {
  it('is disabled while the editor still holds the starter', () => {
    render(<ResetPill lessonId="a" atStarter onReset={vi.fn()} canUndo={false} />)
    expect(screen.getByRole('button', { name: /Reset/ })).toHaveProperty('disabled', true)
  })

  it('resets, then offers to undo once', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn(() => true)
    const onUndo = vi.fn()
    render(<ResetPill lessonId="a" atStarter={false} onReset={onReset} onUndo={onUndo} canUndo />)
    await user.click(screen.getByRole('button', { name: /Reset/ }))
    expect(onReset).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Undo reset' }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Undo reset' })).toBeNull()
  })

  it('offers no undo when the reset was refused', async () => {
    const user = userEvent.setup()
    render(<ResetPill lessonId="a" atStarter={false} onReset={() => false} onUndo={vi.fn()} canUndo />)
    await user.click(screen.getByRole('button', { name: /Reset/ }))
    expect(screen.queryByRole('button', { name: 'Undo reset' })).toBeNull()
  })
})
