import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ResultEvent } from '../execution/protocol'
import { ResultsPanel } from './ResultsPanel'

describe('branch labels in Results', () => {
  it('marks each output with the if or else that printed it', () => {
    const code = 'for mail in ["j@o.com", "sam@web.de"]:\n    if len(mail) < 8:\n        print("short")\n    else:\n        print("long")\nprint("done")\n'
    const events = [
      { kind: 'print', text: 'short', line: 3 },
      { kind: 'print', text: 'long', line: 5 },
      { kind: 'print', text: 'done', line: 6 },
    ] as ResultEvent[]
    const { container } = render(<ResultsPanel events={events} status="success" durationMs={1} sourceCode={code} />)
    const rows = [...container.querySelectorAll('.result-row')]
    expect(rows.map((row) => row.querySelector('.branch-chip')?.textContent ?? null)).toEqual([
      'if branch, line 2:',
      'else branch, line 4:',
      null,
    ])
  })
})
