import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ResultEvent } from '../execution/protocol'
import { ResultsPanel } from './ResultsPanel'

describe('a tuple of strings in Results', () => {
  it('shows each item once, in the collection card only', () => {
    const structure = { kind: 'tuple', length: 2, items: [
      { kind: 'atom', type: 'str', preview: "'Add milk'" },
      { kind: 'atom', type: 'str', preview: "'more milk'" },
    ] } as const
    const events = [{ kind: 'expr', value: "('Add milk', 'more milk')", line: 4, structure }] as unknown as ResultEvent[]
    const { container } = render(<ResultsPanel events={events} status="success" durationMs={1} />)
    expect(container.textContent?.match(/Add milk/g)).toHaveLength(1)
    expect(container.textContent?.match(/more milk/g)).toHaveLength(1)
  })
})
