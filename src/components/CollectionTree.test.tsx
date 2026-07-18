import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectionTree } from './CollectionTree'
import type { CollectionNode } from '../execution/collectionStructure'

const nested: CollectionNode = {
  kind: 'dict',
  length: 1,
  entries: [
    {
      key: { kind: 'atom', type: 'str', preview: "'scores'" },
      value: {
        kind: 'list',
        length: 2,
        items: [
          { kind: 'atom', type: 'int', preview: '10' },
          { kind: 'atom', type: 'int', preview: '20' },
        ],
      },
    },
  ],
}

describe('CollectionTree', () => {
  it('shows list label and items expanded at the root', () => {
    render(
      <CollectionTree
        node={{
          kind: 'list',
          length: 2,
          items: [
            { kind: 'atom', type: 'int', preview: '1' },
            { kind: 'atom', type: 'str', preview: "'hi'" },
          ],
        }}
      />,
    )
    expect(screen.getByText('list(2)')).toBeInTheDocument()
    expect(screen.getByText("'hi'")).toBeInTheDocument()
    expect(document.querySelectorAll('.coll-atom')).toHaveLength(2)
    expect(
      document.querySelector('.coll-atom-value')?.textContent,
    ).toBe('1')
    expect(screen.getByText('int')).toBeInTheDocument()
  })

  it('collapses and expands nested collections', async () => {
    const user = userEvent.setup()
    render(<CollectionTree node={nested} />)
    expect(screen.getByText('dict(1)')).toBeInTheDocument()
    // Nested list starts collapsed — summary visible, items not.
    expect(screen.getByText('list(2)')).toBeInTheDocument()
    expect(screen.queryByText('10')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /list\(2\)/i }))
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('renders empty collections without a toggle action', () => {
    render(<CollectionTree node={{ kind: 'list', length: 0, items: [] }} />)
    const btn = screen.getByRole('button', { name: /list\(0\)/i })
    expect(btn).toBeDisabled()
    expect(screen.getByText('[]')).toBeInTheDocument()
  })
})
