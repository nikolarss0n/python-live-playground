import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getLesson } from '../examples'
import { enrichResultEvents, taskEvidenceLine } from '../taskEvidence'
import { ResultsPanel } from './ResultsPanel'

describe('ResultsPanel task evidence', () => {
  it('shows post-run evidence that cites the printing lesson’s actual output or missing fill', () => {
    const lesson = getLesson('printing')
    const events = [
      { kind: 'print' as const, text: 'Hello, world!', line: 5 },
    ]
    const run = {
      code: lesson.code,
      executedCode: lesson.code,
      status: 'error' as const,
      events: [
        {
          kind: 'error' as const,
          message: "NameError: name '???' is not defined",
          friendly: "NameError: name '???' is not defined",
          traceback: '',
          line: 6,
        },
      ],
    }
    const line = taskEvidenceLine(lesson, run)
    expect(line).toBeTruthy()

    render(
      <ResultsPanel
        events={events}
        status="error"
        durationMs={9}
        taskEvidence={line}
      />,
    )

    const evidence = screen.getByRole('status', { name: /task evidence/i })
    expect(evidence).toHaveTextContent(/\?\?\?/)
    expect(evidence).toHaveTextContent(/print/i)
  })

  it('shows a lesson-aware What to fix tip for leftover ??? NameError', () => {
    const lesson = getLesson('printing')
    const events = enrichResultEvents(lesson, lesson.code, [
      {
        kind: 'error',
        message: "NameError: name '???' is not defined",
        friendly: "NameError: name '???' is not defined",
        traceback: 'Traceback…',
        line: 6,
      },
    ])

    render(
      <ResultsPanel events={events} status="error" durationMs={9} />,
    )

    const tip = document.querySelector('.error-card-tip-text')
    expect(tip).toBeTruthy()
    expect(tip?.textContent).toMatch(/replace \?\?\?/i)
    expect(tip?.textContent).toMatch(/second print|quoted/i)
  })

  it('copies formatted results output in one click', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const events = [
      { kind: 'print' as const, text: 'hello', line: 1 },
      { kind: 'expr' as const, value: '42', line: 2 },
    ]

    render(<ResultsPanel events={events} status="success" durationMs={4} />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy results' }))
    expect(writeText).toHaveBeenCalledWith('hello\n42')
    expect(screen.getByRole('button', { name: 'Copy results' })).toHaveTextContent('Copied')
  })
})
