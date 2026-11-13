import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SettingsModal } from './SettingsModal'

function SettingsHarness() {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open settings</button>
    <button type="button">Background control</button>
    <SettingsModal open={open} onClose={() => setOpen(false)} />
  </>
}

beforeEach(() => localStorage.clear())

describe('Settings keyboard focus', () => {
  it('takes focus on Enter, makes the page inert, and wraps Tab in both directions', async () => {
    const user = userEvent.setup()
    const { container } = render(<SettingsHarness />)
    const opener = screen.getByRole('button', { name: 'Open settings' })
    opener.focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    const first = within(dialog).getByLabelText('API key')
    const last = within(dialog).getByRole('button', { name: 'Save' })
    expect(first).toHaveFocus()
    expect(container).toHaveAttribute('inert')
    for (let i = 0; i < 10; i++) { await user.tab(); expect(dialog.contains(document.activeElement)).toBe(true) }
    for (let i = 0; i < 10; i++) { await user.tab({ shift: true }); expect(dialog.contains(document.activeElement)).toBe(true) }
    last.focus(); await user.tab(); expect(first).toHaveFocus()
    await user.tab({ shift: true }); expect(last).toHaveFocus()
    first.focus(); await user.type(first, 'local-test-value'); expect(first).toHaveFocus()
  })

  it.each(['Escape', 'Cancel', 'overlay'])('%s restores focus and releases inert', async (method) => {
    const user = userEvent.setup()
    const { container } = render(<SettingsHarness />)
    const opener = screen.getByRole('button', { name: 'Open settings' })
    await user.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    if (method === 'Escape') await user.keyboard('{Escape}')
    else if (method === 'Cancel') await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    else {
      const overlay = dialog.parentElement
      if (!overlay) throw new Error('Missing Settings overlay')
      await user.click(overlay)
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(container).not.toHaveAttribute('inert')
  })
})
