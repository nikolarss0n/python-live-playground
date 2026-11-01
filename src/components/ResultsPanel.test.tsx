import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
