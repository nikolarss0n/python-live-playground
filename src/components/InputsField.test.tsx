import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { InputsField } from './InputsField'
import { usesInput } from '../usesInput'
import { explainError } from '../execution/errorExplain'

describe('usesInput', () => {
  it.each(['name = input()', 'age = int(input("Age? "))', 'x = input ("?")'])('shows the box for %j', (code) => {
    expect(usesInput(code)).toBe(true)
  })

  it.each(['print("hi")', 'user_input = 3', 'raw_input(x)', 'form.input(x)'])('hides the box for %j', (code) => {
    expect(usesInput(code)).toBe(false)
  })
})

describe('InputsField', () => {
  it('is a labelled text box that reports each edit', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    function Host() {
      const [value, setValue] = useState('')
      return <InputsField value={value} onChange={(next) => { seen.push(next); setValue(next) }} />
    }
    render(<Host />)
    const box = screen.getByRole('textbox', { name: 'Inputs' })
    expect(box.getAttribute('aria-describedby')).toBeTruthy()
    await user.type(box, 'Ada{Enter}36')
    expect(seen.at(-1)).toBe('Ada\n36')
    expect(box.getAttribute('rows')).toBe('2')
  })
})

describe('EOFError explanation', () => {
  it('points the learner at the Inputs box', () => {
    const explanation = explainError('EOFError: input() needs a value, but the Inputs box is empty')
    expect(explanation.title).toBe('input() ran out of values')
    expect(explanation.tip).toMatch(/Inputs box/)
  })
})
