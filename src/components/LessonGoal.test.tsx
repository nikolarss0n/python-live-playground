import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../examples'
import type { LessonProgressView } from '../lessonProgress'
import { LessonGoal } from './LessonGoal'

const lesson: Lesson = {
  id: 'instruction-test',
  difficulty: 'beginner',
  number: 1,
  topic: 'Instructions',
  chapter: 'Basics',
  goal: 'Follow two small steps.',
  why: 'Clear steps help learners connect an edit with the result it creates.',
  tasks: ['Finish the first edit', 'Check the second result'],
  taskInstructions: [
    'This completed instruction should no longer be shown.',
    'Run the code and compare the second result with the expected value.',
  ],
  code: 'print(1)',
}

function renderGoal(
  tasks: LessonProgressView['tasks'],
  expanded = true,
  onToggleExpanded = vi.fn(),
) {
  const view: LessonProgressView = {
    tasks,
    next: 'Run the code',
    extraHint: null,
    showStuckControl: false,
    allTasksDone: false,
    goalMet: false,
  }

  return render(
    <LessonGoal
      lesson={lesson}
      progress={{ met: false, missing: ['Run the code'] }}
      view={view}
      onRevealStuck={vi.fn()}
      code={lesson.code}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
    />,
  )
}

describe('LessonGoal task guidance', () => {
  function FocusHarness() {
    const [expanded, setExpanded] = useState(false)
    return <>
      <button type="button">Outside lesson</button>
      <LessonGoal lesson={lesson} progress={{ met: false, missing: [] }} code={lesson.code}
        view={{ tasks: [], next: null, extraHint: null, showStuckControl: false, allTasksDone: false, goalMet: false }}
        onRevealStuck={vi.fn()} onRestart={vi.fn()} expanded={expanded} onToggleExpanded={() => setExpanded((value) => !value)} />
    </>
  }

  it.each(['Escape', 'close button'])('%s inside the box returns focus to the Lesson pill', async (method) => {
    const user = userEvent.setup()
    render(<FocusHarness />)
    const pill = screen.getByRole('button', { name: 'Show lesson' })
    await user.click(pill)
    const close = screen.getByRole('button', { name: 'Close lesson' })
    close.focus()
    if (method === 'Escape') await user.keyboard('{Escape}')
    else await user.click(close)
    expect(pill).toHaveFocus()
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('group', { name: 'Lesson details' })).not.toBeInTheDocument()
  })

  it('keeps inside clicks open and lets outside clicks keep their focus', async () => {
    const user = userEvent.setup()
    render(<FocusHarness />)
    const pill = screen.getByRole('button', { name: 'Show lesson' })
    await user.click(pill)
    await user.click(screen.getByRole('button', { name: 'Restart exercise' }))
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    const outside = screen.getByRole('button', { name: 'Outside lesson' })
    await user.click(outside)
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    expect(outside).toHaveFocus()
  })

  it.each([
    { label: 'two-column fallback', x: 721, y: 100, width: 719, height: 700, header: 42, evidence: 0, bodyGap: null },
    { label: 'stacked fallback', x: 0, y: 420, width: 320, height: 270, header: 48, evidence: 0, bodyGap: null },
    { label: 'fallback with a status line', x: 721, y: 100, width: 719, height: 700, header: 42, evidence: 24, bodyGap: null },
    { label: 'stacked fallback with a wrapped status line', x: 0, y: 420, width: 320, height: 270, header: 48, evidence: 48, bodyGap: null },
    { label: 'two-column Results body', x: 721, y: 100, width: 719, height: 700, header: 42, evidence: 24, bodyGap: 0 },
    { label: 'stacked Results body', x: 0, y: 420, width: 390, height: 270, header: 48, evidence: 24, bodyGap: 0 },
    { label: 'Results body below additional content', x: 721, y: 100, width: 719, height: 700, header: 42, evidence: 0, bodyGap: 32 },
  ])('places the box at the body top or preserves the fallback: $label', ({ x, y, width, height, header, evidence, bodyGap }) => {
    const rectangle = (left: number, top: number, rectWidth: number, rectHeight: number) =>
      new DOMRect(left, top, rectWidth, rectHeight)
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('workspace')) return rectangle(0, 100, 1440, 700)
      if (this.classList.contains('pane-results')) return rectangle(x, y, width, height)
      if (this.classList.contains('results-head')) return rectangle(x, y, width, header)
      if (this.classList.contains('results-task-evidence')) return rectangle(x, y + header, width, evidence)
      if (this.classList.contains('results-body')) return rectangle(x, y + header + evidence + (bodyGap ?? 0), width, height - header - evidence - (bodyGap ?? 0))
      return rectangle(0, 0, 0, 0)
    })
    try {
      render(<main className="workspace">
        <div className="pane-editor"><div className="pane-head">
          <LessonGoal lesson={lesson} progress={{ met: false, missing: [] }} code={lesson.code}
            view={{ tasks: [], next: null, extraHint: null, showStuckControl: false, allTasksDone: false, goalMet: false }}
            onRevealStuck={vi.fn()} expanded onToggleExpanded={vi.fn()} />
        </div></div>
        <div className="pane-results"><div className="results-head">Results</div>
          {evidence > 0 ? <p className="results-task-evidence">Fix the execution error before the behavior checks can finish.</p> : null}
          {bodyGap !== null ? <div className="results-body">Results content</div> : null}
        </div>
      </main>)
      const box = screen.getByRole('group', { name: 'Lesson details' })
      expect(box.style.getPropertyValue('--lesson-left')).toBe(`${x + 8}px`)
      const offset = bodyGap ?? 8
      expect(box.style.getPropertyValue('--lesson-top')).toBe(`${y + header + evidence + offset - 100}px`)
      expect(box.style.getPropertyValue('--lesson-width')).toBe(`${width - 16}px`)
      expect(box.style.getPropertyValue('--lesson-height')).toBe(`${height - header - evidence - offset - 8}px`)
      Object.defineProperties(box, { scrollHeight: { value: 700 }, clientHeight: { value: 200 } })
      fireEvent.scroll(box)
      expect(box).toHaveAttribute('data-more-below', 'true')
      box.scrollTop = 500
      fireEvent.scroll(box)
      expect(box).toHaveAttribute('data-more-below', 'false')
    } finally { bounds.mockRestore() }
  })

  it('tabs from the Lesson pill straight into its box', async () => {
    const user = userEvent.setup()
    render(<FocusHarness />)
    await user.click(screen.getByRole('button', { name: 'Show lesson' }))
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close lesson' })).toHaveFocus()
  })

  it('hides completed guidance and promotes the next unfinished step', () => {
    const { container } = renderGoal([
      {
        text: lesson.tasks[0],
        instruction: lesson.taskInstructions?.[0] ?? null,
        status: 'done',
      },
      {
        text: lesson.tasks[1],
        instruction: lesson.taskInstructions?.[1] ?? null,
        status: 'todo',
      },
    ])

    expect(
      screen.queryByText(/completed instruction should no longer/i),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/compare the second result/i)).toBeInTheDocument()
    expect(container.querySelector('.lesson-task.is-current')).toHaveTextContent(
      'Check the second result',
    )
    expect(screen.getByText('How')).toBeInTheDocument()
    expect(screen.queryByText('Then')).not.toBeInTheDocument()
  })

  it('keeps the default summary compact and exposes an accessible toggle', async () => {
    const onToggleExpanded = vi.fn()
    const user = userEvent.setup()

    renderGoal(
      [
        {
          text: lesson.tasks[0],
          instruction: lesson.taskInstructions?.[0] ?? null,
          status: 'done',
        },
        {
          text: lesson.tasks[1],
          instruction: lesson.taskInstructions?.[1] ?? null,
          status: 'todo',
        },
      ],
      false,
      onToggleExpanded,
    )

    const toggle = screen.getByRole('button', { name: /show lesson/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    for (const text of screen.getAllByText('Check the second result')) expect(text).not.toBeVisible()
    expect(screen.getByLabelText('1 of 2 tasks complete')).toHaveTextContent(
      '1/2',
    )
    expect(
      screen.queryByRole('group', { name: /lesson details/i }),
    ).not.toBeInTheDocument()

    await user.click(toggle)
    expect(onToggleExpanded).toHaveBeenCalledOnce()
  })
})
