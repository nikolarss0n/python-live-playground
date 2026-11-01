import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ConceptPills } from './ConceptPills'

const concepts = [
  { term: 'Conversions', explanation: 'int("3") turns text into a number.', example: 'int("3")' },
  { term: 'def and return', explanation: 'return hands a value back.', example: 'def f():\n    return 1' },
]

describe('ConceptPills', () => {
  it('opens one hint at a time and closes it from the pill, the close button, or Escape', async () => {
    render(<ConceptPills concepts={concepts} />)
    const conversions = screen.getByRole('button', { name: 'Conversions' })
    expect(screen.queryByText(concepts[0].explanation)).toBeNull()

    await userEvent.click(conversions)
    expect(conversions).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Conversions' })).toHaveTextContent(concepts[0].explanation)

    await userEvent.click(screen.getByRole('button', { name: 'def and return' }))
    expect(screen.queryByText(concepts[0].explanation)).toBeNull()
    expect(screen.getByText(concepts[1].explanation)).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Close hint' }))
    expect(screen.queryByRole('region')).toBeNull()

    await userEvent.click(conversions)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region')).toBeNull()
    expect(conversions).toHaveFocus()

    await userEvent.click(conversions)
    await userEvent.click(conversions)
    expect(conversions).toHaveAttribute('aria-expanded', 'false')
  })
})
