import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ExerciseCheck } from '../serviceExercise'
import { RefresherPanel } from './RefresherPanel'
import { getRefresherDay } from './catalog'
import type { RefresherDay, RefresherDayId } from './types'
import type { useRefresherSession } from './useRefresherSession'

type Session = ReturnType<typeof useRefresherSession>

function day(id: RefresherDayId): RefresherDay {
  const entry = getRefresherDay(id)
  if (!entry) throw new Error(`Missing day ${id}`)
  return entry
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    stage: 'recall', code: '', note: '', notes: { recall: '', explain: '', guided: '', independent: '', review: '' },
    context: {}, contextKey: 'practice/recall', guidedCode: '', independentCode: '',
    completedStages: { recall: false, explain: false, guided: false, independent: false, review: false },
    completedDayIds: new Set(), saveStatus: 'saved', loadStatus: 'empty', mistakes: [], rubric: null,
    selectedDays: ['refresher-03', 'refresher-04'], mock: null, isReadOnly: false,
    hasRunningMock: false, runningMockDayId: null, canRestore: false,
    changeStage: vi.fn(() => true), updateCode: vi.fn(() => true), setNote: vi.fn(() => true),
    completeStage: vi.fn(() => true), verify: vi.fn(() => true), restart: vi.fn(() => true), restore: vi.fn(() => true),
    addMistake: vi.fn(() => true), editMistake: vi.fn(() => true), resolveMistake: vi.fn(() => true),
    startMock: vi.fn(() => true), finishMock: vi.fn(() => true), setRubric: vi.fn(() => true), selectDays: vi.fn(() => true),
    ...overrides,
  }
}

const activeAttempt: NonNullable<Session['mock']> = {
  active: true, elapsedMs: 15 * 60_000, remainingMs: 45 * 60_000, followUp: false,
  phase: 'implement', variantId: 'a', retake: false, startedAt: 1000, finishedAt: null, submittedCode: null,
}

function mount(metadata: RefresherDay, state: Session, checks: ExerciseCheck[] = []) {
  const onRun = vi.fn()
  const rendered = render(<RefresherPanel day={metadata} session={state} checks={checks} checksFresh={checks.length > 0} executionStatus="ready" onRun={onRun} />)
  return { ...rendered, onRun }
}

async function showSession() {
  const button = screen.getByRole('button', { name: 'Task' })
  if (button.getAttribute('aria-expanded') === 'false') await userEvent.click(button)
}

describe('RefresherPanel practice flow', () => {
  it('starts with visible recall, saves the note, and advances only after a meaningful note', async () => {
    const state = session()
    mount(day('refresher-01'), state)
    const next = screen.getByRole('button', { name: 'Continue' })
    expect(next).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Recall' })).toHaveAttribute('aria-current', 'step')
    await userEvent.type(screen.getByLabelText('Recall note'), 'Return gives a value to the caller.')
    await userEvent.click(next)
    expect(state.setNote).toHaveBeenCalledWith('Return gives a value to the caller.', 'recall')
    expect(state.completeStage).toHaveBeenCalledWith('recall')
    expect(state.changeStage).toHaveBeenCalledWith('explain')
  })

  it('requires an explanation acknowledgement and keeps syntax examples out of the panel', async () => {
    const metadata = day('refresher-01')
    const state = session({ stage: 'explain', contextKey: 'practice/explain' })
    const { onRun } = mount(metadata, state)
    await showSession()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.queryByText(metadata.concepts.at(-1)?.explanation ?? '')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Run worked example' }))
    expect(onRun).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByLabelText('I can explain the examples in my own words'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(state.completeStage).toHaveBeenCalledWith('explain')
  })

  it('keeps independent attempts free of hints, worked solutions, and mistake patterns', async () => {
    const metadata = day('refresher-03')
    const state = session({ stage: 'independent', contextKey: 'practice/independent' })
    const checks = metadata.checks.map((check) => ({ ...check, passed: true, detail: 'Passed' }))
    const { rerender, onRun } = mount(metadata, state, checks)
    await showSession()
    expect(screen.queryByText(metadata.hints[0])).not.toBeInTheDocument()
    expect(screen.queryByText(metadata.concepts[0].explanation)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mistake log \(/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    const completed = session({ ...state, completedStages: { ...state.completedStages, independent: true } })
    rerender(<RefresherPanel day={metadata} session={completed} checks={checks} checksFresh executionStatus="success" onRun={onRun} />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(completed.changeStage).toHaveBeenCalledWith('review')
  })

  it('reports stale checks as not checked and keeps failed-check feedback specific', async () => {
    const metadata = day('refresher-02')
    const state = session({ stage: 'guided' })
    const failed = [{ ...metadata.checks[0], passed: false, detail: 'False must count as a failed run.' }]
    const { rerender, onRun } = mount(metadata, state, failed)
    await showSession()
    expect(screen.getByText('False must count as a failed run.')).toBeVisible()
    rerender(<RefresherPanel day={metadata} session={state} checks={failed} checksFresh={false} executionStatus="running" onRun={onRun} />)
    expect(screen.queryByText('False must count as a failed run.')).not.toBeInTheDocument()
    expect(screen.getAllByText('Not checked')).toHaveLength(3)
  })

  it('saves three-part mistakes and lets existing entries be edited and resolved', async () => {
    const entry = { id: 'mistake-1', dayId: 'refresher-01' as const, error: 'Printed instead of returned', cause: 'Confused output with values', correctPattern: 'return value', createdAt: 1, resolved: false }
    const state = session({ mistakes: [entry] })
    mount(day('refresher-01'), state)
    await userEvent.click(screen.getByText('Mistake log (1 open)', { selector: 'summary' }))
    await userEvent.type(screen.getByLabelText('Error'), 'Forgot colon')
    await userEvent.type(screen.getByLabelText('Cause'), 'Rushed the header')
    await userEvent.type(screen.getByLabelText('Correct pattern'), 'def name():')
    await userEvent.click(screen.getByRole('button', { name: 'Save mistake', exact: true }))
    expect(state.addMistake).toHaveBeenCalledWith({ dayId: 'refresher-01', error: 'Forgot colon', cause: 'Rushed the header', correctPattern: 'def name():' })
    await userEvent.click(screen.getByRole('button', { name: `Edit mistake: ${entry.error}` }))
    await userEvent.clear(screen.getByLabelText('Cause'))
    await userEvent.type(screen.getByLabelText('Cause'), 'Did not inspect the caller')
    await userEvent.click(screen.getByRole('button', { name: 'Save mistake changes' }))
    expect(state.editMistake).toHaveBeenCalledWith('mistake-1', { error: entry.error, cause: 'Did not inspect the caller', correctPattern: entry.correctPattern })
    await userEvent.click(screen.getByRole('button', { name: 'Mark resolved' }))
    expect(state.resolveMistake).toHaveBeenCalledWith('mistake-1', true)
  })

  it('explains failed safe restart and unavailable storage without claiming success', async () => {
    const state = session({ saveStatus: 'unavailable', restart: vi.fn(() => false) })
    mount(day('refresher-01'), state)
    expect(screen.getByRole('status')).toHaveTextContent('Browser storage is unavailable')
    expect(screen.getByRole('button', { name: 'Restore previous draft' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Restart current stage' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Your current draft was kept')
  })

  it('requires review acknowledgement plus reflection, and supports the local lab link', async () => {
    const state = session({ stage: 'review', contextKey: 'practice/review' })
    mount(day('refresher-07'), state)
    await showSession()
    const complete = screen.getByRole('button', { name: 'Mark review complete' })
    expect(complete).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Reflection'), 'I now check False separately from missing input.')
    await userEvent.click(screen.getByLabelText('I reviewed my mistakes and recorded a correction'))
    await userEvent.click(complete)
    expect(state.completeStage).toHaveBeenCalledWith('review')
    expect(screen.getByRole('link', { name: 'Download local Python practice' })).toHaveAttribute('href', '/labs/python-refresher.zip')
  })

  it('offers two distinct consolidation functions and uses Guided only for planning', async () => {
    const state = session({ stage: 'guided', contextKey: 'revisit/guided' })
    mount(day('refresher-14'), state)
    await showSession()
    await userEvent.click(screen.getByText('Two functions to revisit', { selector: 'summary' }))
    expect(within(screen.getByLabelText('Function 1')).getByRole('option', { name: 'Day 3: unique_ids' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Function 1'), 'refresher-04')
    expect(screen.getByRole('button', { name: 'Use these two exercises' })).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Function 1'), 'refresher-06')
    await userEvent.click(screen.getByRole('button', { name: 'Use these two exercises' }))
    expect(state.selectDays).toHaveBeenCalledWith(['refresher-06', 'refresher-04'])
    expect(screen.queryByRole('button', { name: 'Run checks' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Working note'), 'Plan both contracts; Run and Stop are available.')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(state.completeStage).toHaveBeenCalledWith('guided')
    expect(state.changeStage).toHaveBeenCalledWith('independent')
  })

  it('shows only the two selected function contracts during consolidation', async () => {
    const state = session({ stage: 'independent', contextKey: 'revisit/independent', selectedDays: ['refresher-05', 'refresher-07'] })
    mount(day('refresher-14'), state)
    await showSession()
    expect(screen.getByRole('heading', { name: 'Day 5: normalize_record' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Day 7: validate_record' })).toBeVisible()
    expect(screen.queryByText(day('refresher-05').problem)).not.toBeInTheDocument()
    expect(screen.queryByText(day('refresher-07').problem)).not.toBeInTheDocument()
  })
})

describe('RefresherPanel timed mocks', () => {
  it('keeps every variant hidden before an explicit start', async () => {
    const metadata = day('refresher-12')
    const state = session()
    mount(metadata, state)
    if (metadata.kind !== 'mock') throw new Error('Expected a mock day')
    for (const variant of metadata.variants) expect(screen.queryByText(variant.prompt)).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Session stages' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start 60-minute mock' }))
    expect(state.startMock).toHaveBeenCalledOnce()
  })

  it('reveals only the active problem and timed follow-up, without checks or learning help', async () => {
    const metadata = day('refresher-13')
    if (metadata.kind !== 'mock') throw new Error('Expected a mock day')
    const variant = metadata.variants[0]
    const state = session({ stage: 'independent', mock: activeAttempt, hasRunningMock: true, runningMockDayId: 'refresher-13' })
    const { rerender, onRun } = mount(metadata, state)
    expect(screen.getByLabelText('Mock time remaining')).toHaveTextContent('45:00')
    expect(screen.getByText(variant.prompt)).toBeVisible()
    expect(screen.queryByLabelText('Exercise checks')).not.toBeInTheDocument()
    expect(screen.queryByText(/Mistake log \(/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(variant.followUp?.prompt ?? '')).not.toBeInTheDocument()
    const changed = session({ ...state, mock: { ...activeAttempt, followUp: true, elapsedMs: 30 * 60_000, remainingMs: 30 * 60_000 } })
    rerender(<RefresherPanel day={metadata} session={changed} checks={[]} checksFresh={false} executionStatus="ready" onRun={onRun} />)
    expect(screen.getByLabelText('Requirement change')).toHaveTextContent(variant.followUp?.prompt ?? '')
    await userEvent.click(screen.getByRole('button', { name: 'Submit attempt' }))
    expect(changed.finishMock).toHaveBeenCalledOnce()
  })

  it('labels early day-13 submissions partial and waits for checks or an error before review', async () => {
    const metadata = day('refresher-13')
    const state = session({ stage: 'independent', mock: { ...activeAttempt, active: false, phase: 'finished', finishedAt: 1001, submittedCode: 'pass' } })
    const { rerender, onRun } = mount(metadata, state)
    expect(screen.getByText(/Partial attempt:/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Review attempt' })).toBeDisabled()
    rerender(<RefresherPanel day={metadata} session={state} checks={[]} checksFresh={false} executionStatus="error" onRun={onRun} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review attempt' }))
    expect(state.changeStage).toHaveBeenCalledWith('review')
  })

  it('saves rubric evidence and reflection for a finished mock without revealing solutions', async () => {
    const state = session({
      stage: 'review', contextKey: 'mock/review', mock: { ...activeAttempt, active: false, phase: 'finished', finishedAt: 1001, submittedCode: 'my submission' },
      rubric: { readability: true, edgeCases: true, debugging: true, communication: true, notes: '' },
    })
    mount(day('refresher-12'), state)
    const rubric = screen.getByRole('group', { name: 'Review your approach' })
    await userEvent.type(within(rubric).getByLabelText('Evidence for this review'), 'I explained tie ordering and tested empty input.')
    fireEvent.blur(within(rubric).getByLabelText('Evidence for this review'))
    expect(state.setRubric).toHaveBeenCalledWith({ notes: 'I explained tie ordering and tested empty input.' })
    await userEvent.type(screen.getByLabelText('Reflection'), 'I would isolate validation earlier next time.')
    await userEvent.click(screen.getByLabelText('I reviewed my mistakes and recorded a correction'))
    await userEvent.click(screen.getByRole('button', { name: 'Mark review complete' }))
    expect(state.completeStage).toHaveBeenCalledWith('review')
    expect(screen.getByRole('button', { name: 'Start another attempt' })).toBeVisible()
  })

  it('explains a running mock elsewhere before another start can be attempted', () => {
    const state = session({ hasRunningMock: true, runningMockDayId: 'refresher-12' })
    mount(day('refresher-13'), state)
    expect(screen.getByText(/Day 12 has a running mock/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Start 60-minute mock' })).toBeDisabled()
  })
})
