import { render, screen } from '@testing-library/react'
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

function renderGoal(tasks: LessonProgressView['tasks']) {
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
    />,
  )
}

describe('LessonGoal task guidance', () => {
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
})
