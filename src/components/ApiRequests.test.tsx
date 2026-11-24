import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { DiscoveredRoute, ExecutionStatus, InvokeRequest, ResultEvent } from '../execution/protocol'
import { ApiRequests } from './ApiRequests'
import { useApiRequests } from './useApiRequests'

const ROUTES: DiscoveredRoute[] = [
  { method: 'GET', path: '/items/{item_id}', callPath: '/items/1', name: 'read_item', query: [{ name: 'q', value: '', required: false }, { name: 'limit', value: '10', required: false }] },
  { method: 'POST', path: '/items', callPath: '/items', name: 'create_item', headers: [{ name: 'x-token', value: 'string', required: true }], body: '{\n  "name": "string"\n}' },
]

type Snapshot = { status: ExecutionStatus; runId: string | null; events: ResultEvent[]; durationMs: number | null }
const RAN: Snapshot = { status: 'success', runId: 'run-1', events: [], durationMs: 4 }
let setSnapshot: (snapshot: Snapshot) => void = () => {}
let setRoutes: (routes: DiscoveredRoute[]) => void = () => {}
let setStale: (stale: boolean) => void = () => {}
let setAutoRun: (autoRun: boolean) => void = () => {}

function Harness({ invoke, start = RAN, onShowLine, onShowResults, runBeforeSend, initialAutoRun = true, active = false }: {
  invoke: (request: InvokeRequest) => Promise<void>
  start?: Snapshot
  onShowLine?: (line: number, file?: string) => void
  onShowResults?: () => void
  runBeforeSend?: () => Promise<void>
  initialAutoRun?: boolean
  active?: boolean
}) {
  const [snapshot, set] = useState(start)
  const [routes, setR] = useState(ROUTES)
  const [stale, setS] = useState(false)
  const [autoRun, setA] = useState(initialAutoRun)
  setSnapshot = set
  setRoutes = setR
  setStale = setS
  setAutoRun = setA
  const api = useApiRequests(routes, snapshot, invoke, { stale, autoRun, active, runBeforeSend })
  return <ApiRequests api={api} stopped={snapshot.status === 'stopped' || snapshot.status === 'timeout'} onShowLine={onShowLine} onShowResults={onShowResults} />
}

const answer = (id: string, status: number, body: string) => act(() => setSnapshot({
  status: 'success', runId: id, durationMs: 3,
  events: [{ kind: 'http', method: 'POST', path: '/items', status, body, simulated: true }],
}))

describe('ApiRequests', () => {
  it('lists every route and shows the first one ready to send', async () => {
    const invoke = vi.fn(async () => {})
    render(<Harness invoke={invoke} />)
    const routes = within(screen.getByRole('list', { name: 'Routes' })).getAllByRole('button')
    expect(routes.map((route) => route.textContent)).toEqual(['GET/items/{item_id}read_item', 'POST/itemscreate_item'])
    expect(routes[0]).toHaveAttribute('aria-current', 'true')
    expect(screen.getByLabelText('Request path')).toHaveValue('/items/1')
    expect(screen.getByLabelText('limit')).toHaveValue('10')
    expect(screen.getByRole('status', { name: 'Response' })).toHaveTextContent('Not sent yet.')

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(invoke).toHaveBeenCalledWith({ method: 'GET', path: '/items/1', query: { limit: '10' } })
  })

  it('sends the picked route with its prepared headers and body, then shows the response', async () => {
    const invoke = vi.fn(async () => {})
    render(<Harness invoke={invoke} />)
    await userEvent.click(screen.getByRole('button', { name: /POST\/items/ }))
    expect(screen.getByLabelText(/x-token/)).toHaveValue('string')
    expect(screen.getByLabelText('Body')).toHaveValue('{\n  "name": "string"\n}')

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(invoke).toHaveBeenCalledWith({ method: 'POST', path: '/items', headers: { 'x-token': 'string' }, body: { name: 'string' } })
    answer('invoke-2', 201, '{"name":"string"}')
    const response = screen.getByRole('status', { name: 'Response' })
    expect(response).toHaveTextContent('201')
    expect(response).toHaveTextContent('Created · 3 ms')
    expect(response).toHaveTextContent("'name'")
    expect(within(screen.getByRole('list', { name: 'Routes' })).getByText('201')).toBeInTheDocument()
  })

  it('keeps an edited request across runs and clears responses when the code runs again', async () => {
    const invoke = vi.fn(async () => {})
    render(<Harness invoke={invoke} />)
    const limit = screen.getByLabelText('limit')
    await userEvent.clear(limit)
    await userEvent.type(limit, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    answer('invoke-2', 200, '{"ok":true}')
    expect(screen.getByRole('status', { name: 'Response' })).toHaveTextContent('200')

    act(() => setSnapshot({ ...RAN, runId: 'run-3' }))
    expect(screen.getByRole('status', { name: 'Response' })).toHaveTextContent('Not sent yet.')
    expect(screen.getByLabelText('limit')).toHaveValue('5')

    // A changed signature replaces the edited request with the newly prepared one.
    act(() => setRoutes([{ ...ROUTES[0], query: [{ name: 'limit', value: '20', required: false }] }, ROUTES[1]]))
    expect(screen.getByLabelText('limit')).toHaveValue('20')
  })

  it('reports a body that is not JSON instead of sending it', async () => {
    const invoke = vi.fn(async () => {})
    render(<Harness invoke={invoke} />)
    await userEvent.click(screen.getByRole('button', { name: /POST\/items/ }))
    await userEvent.clear(screen.getByLabelText('Body'))
    await userEvent.type(screen.getByLabelText('Body'), 'name')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Body must be valid JSON')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('cannot send after the app was stopped', () => {
    render(<Harness invoke={vi.fn(async () => {})} start={{ ...RAN, status: 'stopped' }} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText('Your app stopped. Run the code to start it again.')).toBeInTheDocument()
  })

  it('marks the fields a 422 names until the request is edited', async () => {
    const invoke = vi.fn(async () => {})
    render(<Harness invoke={invoke} />)
    await userEvent.click(within(screen.getByRole('list', { name: 'Routes' })).getAllByRole('button')[1])
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    answer('invoke-1', 422, JSON.stringify({ detail: [
      { loc: ['header', 'x-token'], msg: 'field required', type: 'missing' },
      { loc: ['body', 'name'], msg: 'String should have at least 3 characters', type: 'string_too_short' },
    ] }))

    const token = screen.getByLabelText(/x-token/)
    expect(token).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Body')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Request path')).not.toHaveAttribute('aria-invalid')
    const reasons = within(screen.getByRole('list', { name: 'What the route refused' })).getAllByRole('listitem')
    expect(reasons.map((reason) => reason.textContent)).toEqual(['x-token field required', 'name String should have at least 3 characters'])

    await userEvent.type(token, 'x')
    expect(token).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('list', { name: 'What the route refused' })).toBeNull()
  })

  it('marks a list parameter when one of its items is refused', async () => {
    render(<Harness invoke={vi.fn(async () => {})} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    act(() => setSnapshot({
      status: 'success', runId: 'invoke-1', durationMs: 3,
      events: [{ kind: 'http', method: 'GET', path: '/items/1', status: 422, simulated: true, body: JSON.stringify({ detail: [{ loc: ['query', 'limit', 0], msg: 'Input should be a valid integer', type: 'type_error' }] }) }],
    }))
    expect(screen.getByLabelText('limit')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('q')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('list', { name: 'What the route refused' })).toHaveTextContent('limit.0 Input should be a valid integer')
  })

  it('links a crashed response to the line that raised', async () => {
    const onShowLine = vi.fn()
    render(<Harness invoke={vi.fn(async () => {})} onShowLine={onShowLine} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    act(() => setSnapshot({
      status: 'success', runId: 'invoke-1', durationMs: 3,
      events: [{ kind: 'http', method: 'GET', path: '/items/1', status: 500, body: '{"detail":"ZeroDivisionError: division by zero"}', simulated: true, line: 7 }],
    }))
    await userEvent.click(screen.getByRole('button', { name: 'Crashed on line 7' }))
    expect(onShowLine).toHaveBeenCalledWith(7, undefined)
  })

  it('names the module file when a project route crashes', async () => {
    const onShowLine = vi.fn()
    render(<Harness invoke={vi.fn(async () => {})} onShowLine={onShowLine} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    act(() => setSnapshot({
      status: 'success', runId: 'invoke-1', durationMs: 3,
      events: [{ kind: 'http', method: 'GET', path: '/items/1', status: 500, body: '{"detail":"ZeroDivisionError: division by zero"}', simulated: true, file: 'routes/items.py', line: 9 }],
    }))
    await userEvent.click(screen.getByRole('button', { name: 'Crashed in routes/items.py on line 9' }))
    expect(onShowLine).toHaveBeenCalledWith(9, 'routes/items.py')
  })

  it('uses a calm syncing state in auto-run without blinking Send, and marks outdated only in manual mode', async () => {
    const invoke = vi.fn(async () => {})
    const runBeforeSend = vi.fn(async () => {})
    render(<Harness invoke={invoke} runBeforeSend={runBeforeSend} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    answer('invoke-1', 200, '{"ok":true}')
    expect(invoke).toHaveBeenCalledTimes(1)

    // In auto-run mode: button stays 'Send', no 'outdated' flash, form enters calm syncing animation.
    act(() => setStale(true))
    const form = screen.getByRole('form', { name: /Request to/ })
    expect(form).toHaveAttribute('data-syncing', 'true')
    expect(screen.getByRole('status', { name: 'Response' })).not.toHaveTextContent('outdated')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()

    // In manual mode: steady 'outdated' indicator, button still stays 'Send', and clicking re-runs before invoking.
    act(() => setAutoRun(false))
    expect(form).not.toHaveAttribute('data-syncing')
    expect(screen.getByRole('status', { name: 'Response' })).toHaveTextContent('outdated')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(runBeforeSend).toHaveBeenCalledOnce()
    expect(invoke).toHaveBeenCalledTimes(1)

    act(() => {
      setStale(false)
      setSnapshot({ status: 'success', runId: 'run-2', events: [], durationMs: 3 })
    })
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('keeps routes visible during a mid-edit syntax error, disables Send, and links to Results', async () => {
    const invoke = vi.fn(async () => {})
    const onShowResults = vi.fn()
    render(<Harness invoke={invoke} onShowResults={onShowResults} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    answer('invoke-1', 200, '{"ok":true}')

    // Code breaks mid-edit: routes drop to [] and status becomes error, yet the API tab stays visible.
    act(() => {
      setRoutes([])
      setSnapshot({ status: 'error', runId: 'run-2', events: [{ kind: 'error', message: 'SyntaxError', friendly: '', traceback: '' }], durationMs: 2 })
    })
    expect(screen.getByRole('list', { name: 'Routes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByRole('status', { name: 'Response' })).toHaveTextContent('Not sent yet.')
    await userEvent.click(screen.getByRole('button', { name: 'Show Results' }))
    expect(onShowResults).toHaveBeenCalledOnce()
  })

  it('clears old 200 responses when the worker resets after Stop while idle', async () => {
    const invoke = vi.fn(async () => {})
    render(<Harness invoke={invoke} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    answer('invoke-1', 200, '{"ok":true}')
    expect(screen.getByRole('status', { name: 'Response' })).toHaveTextContent('200')

    act(() => setSnapshot({ status: 'ready', runId: null, events: [], durationMs: null }))
    expect(screen.getByRole('status', { name: 'Response' })).toHaveTextContent('Not sent yet.')
  })

  it('auto-refreshes an already-sent GET route on code re-run when active, shows handler prints, and resets edited drafts', async () => {
    const invoke = vi.fn(async () => {})
    render(<Harness invoke={invoke} active />)
    const limit = screen.getByLabelText('limit')
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
    await userEvent.clear(limit)
    await userEvent.type(limit, '5')
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(invoke).toHaveBeenCalledTimes(1)
    act(() => setSnapshot({
      status: 'success', runId: 'invoke-1', durationMs: 3,
      events: [{ kind: 'print', text: 'audit: GET /items/1' }, { kind: 'http', method: 'GET', path: '/items/1', status: 200, body: '{"ok":true}', simulated: true }],
    }))
    expect(screen.getByLabelText('Handler output')).toHaveTextContent('audit: GET /items/1')

    // Code re-runs while viewing this GET route -> automatically re-invokes with the edited draft.
    act(() => setSnapshot({ status: 'success', runId: 'run-2', events: [], durationMs: 4 }))
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(invoke).toHaveBeenLastCalledWith({ method: 'GET', path: '/items/1', query: { limit: '5' } })

    // Reset snaps the edited draft back to the prepared defaults.
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(limit).toHaveValue('10')
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
  })
})
