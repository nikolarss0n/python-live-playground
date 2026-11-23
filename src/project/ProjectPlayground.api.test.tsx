import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DiscoveredRoute, InvokeRequest } from '../execution/protocol'
import type { RunnerSnapshot } from '../execution/PythonRunner'
import { ProjectPlayground } from './ProjectPlayground'
import type { ProjectWorkspace } from './useProjectWorkspace'

const invokeMock = vi.fn<(request: InvokeRequest) => Promise<void>>(async () => {})
let mockSnapshot: RunnerSnapshot = {
  status: 'success',
  events: [],
  durationMs: 5,
  runId: 'run-1',
  error: null,
  executedCode: '',
  routes: [],
}

vi.mock('../execution/usePythonExecution', () => ({
  usePythonExecution: () => ({
    snapshot: mockSnapshot,
    runNow: vi.fn(async () => {}),
    stop: vi.fn(),
    invoke: invokeMock,
    isBooting: false,
    isRunning: false,
  }),
}))

function makeWorkspace(openFile = vi.fn()): ProjectWorkspace {
  const files = {
    'main.py': 'from fastapi import FastAPI\nfrom routes import router\napp = FastAPI()\napp.include_router(router)\n',
    'routes.py': 'from fastapi import APIRouter\nrouter = APIRouter()\n@router.get("/crash")\ndef crash():\n    return 1 / 0\n',
  }
  return {
    enabled: true,
    setEnabled: vi.fn(),
    project: { name: 'Bookshop', entry: 'main.py', activePath: 'main.py', openPaths: ['main.py'], folders: [], files },
    projectNames: ['Bookshop'],
    dirtyPaths: new Set(),
    saveError: null,
    saveNow: vi.fn(() => true),
    openFile,
    closeFile: vi.fn(() => true),
    editFile: vi.fn(),
    setEntry: vi.fn(() => true),
    createFile: vi.fn(() => null),
    createFolder: vi.fn(() => null),
    renameFolder: vi.fn(() => true),
    deleteFolder: vi.fn(() => true),
    renameFile: vi.fn(() => true),
    deleteFile: vi.fn(() => true),
    createProject: vi.fn(() => null),
    switchProject: vi.fn(),
    resetStarter: vi.fn(),
  }
}

const ROUTES: DiscoveredRoute[] = [
  { method: 'GET', path: '/crash', callPath: '/crash', name: 'crash' },
]

describe('ProjectPlayground API tab', () => {
  it('stays hidden for plain Python projects without FastAPI routes', () => {
    mockSnapshot = { status: 'success', events: [], durationMs: 2, runId: 'run-1', error: null, executedCode: '', routes: [] }
    render(<ProjectPlayground workspace={makeWorkspace()} onExit={vi.fn()} />)
    expect(screen.queryByRole('tab', { name: /API/ })).toBeNull()
  })

  it('shows the API tab for FastAPI projects, sends requests, and opens the crashing module file', async () => {
    const openFile = vi.fn()
    const workspace = makeWorkspace(openFile)
    const executedProject = { entry: 'main.py', files: workspace.project.files, folders: [] }
    mockSnapshot = { status: 'success', events: [], durationMs: 4, runId: 'run-1', error: null, executedCode: '', executedProject, routes: ROUTES }

    const { rerender } = render(<ProjectPlayground workspace={workspace} onExit={vi.fn()} />)
    const apiTab = screen.getByRole('tab', { name: /API/ })
    expect(apiTab).toHaveTextContent('API1')

    await userEvent.click(apiTab)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(invokeMock).toHaveBeenCalledWith({ method: 'GET', path: '/crash' })

    mockSnapshot = {
      ...mockSnapshot,
      runId: 'invoke-2',
      events: [{ kind: 'http', method: 'GET', path: '/crash', status: 500, body: '{"detail":"ZeroDivisionError: division by zero"}', simulated: true, file: 'routes.py', line: 5 }],
    }
    act(() => rerender(<ProjectPlayground workspace={workspace} onExit={vi.fn()} />))

    await userEvent.click(screen.getByRole('button', { name: 'Crashed in routes.py on line 5' }))
    expect(openFile).toHaveBeenCalledWith('routes.py')
  })
})
