import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ShortcutsModal } from './ShortcutsModal'

function Harness() {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open shortcuts</button>
    <ShortcutsModal open={open} onClose={() => setOpen(false)} hint="Keyboard help" />
  </>
}

describe('Shortcuts keyboard focus', () => {
  it('explains editor exit and keeps keyboard focus in its modal', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open shortcuts' })
    opener.focus(); await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    const close = within(dialog).getByRole('button', { name: 'Close' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText('Esc then Tab: leave the editor')).toBeVisible()
    expect(container).toHaveAttribute('inert')
    expect(close).toHaveFocus()
    for (let i = 0; i < 10; i++) { await user.tab(); expect(close).toHaveFocus(); await user.tab({ shift: true }); expect(close).toHaveFocus() }
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(container).not.toHaveAttribute('inert')
    expect(opener).toHaveFocus()
  })

  it.each(['Close', 'overlay', '?'])('%s closes and returns to the opening control', async (method) => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open shortcuts' })
    await user.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    if (method === '?') await user.keyboard('?')
    else if (method === 'Close') await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    else {
      if (!dialog.parentElement) throw new Error('Missing Shortcuts overlay')
      await user.click(dialog.parentElement)
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
