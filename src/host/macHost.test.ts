import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleHostCommand, installMacHost, isMacHost, MAX_OPEN_FILE_CHARS, parseHostCommand, postHostEvent } from './macHost'

const actions = () => ({
  run: vi.fn(), stop: vi.fn(), getCode: vi.fn(() => 'print(1)'), openFile: vi.fn(), markSaved: vi.fn(),
  openFolder: vi.fn(), syncFolder: vi.fn(), markFolderSaved: vi.fn(),
})

afterEach(() => {
  delete (window as unknown as { webkit?: unknown }).webkit
  delete (window as unknown as { playgroundHost?: unknown }).playgroundHost
  delete document.documentElement.dataset.host
  document.documentElement.style.removeProperty('--glass-tint')
})

describe('mac host commands', () => {
  it('accepts only the commands it knows, rebuilt field by field', () => {
    expect(parseHostCommand({ type: 'run', extra: 1 })).toEqual({ type: 'run' })
    expect(parseHostCommand({ type: 'openFile', name: 'a.py', code: 'x = 1' })).toEqual({ type: 'openFile', name: 'a.py', code: 'x = 1' })
    expect(parseHostCommand({ type: 'openFile', name: 'a.py' })).toBeNull()
    expect(parseHostCommand({ type: 'openFile', name: 'a.py', code: 'x'.repeat(MAX_OPEN_FILE_CHARS + 1) })).toBeNull()
    expect(parseHostCommand({ type: 'markSaved', code: 'x = 1' })).toEqual({ type: 'markSaved', code: 'x = 1' })
    expect(parseHostCommand({ type: 'markSaved', code: 1 })).toBeNull()
    expect(parseHostCommand({ type: 'markSaved', code: 'x'.repeat(MAX_OPEN_FILE_CHARS + 1) })).toBeNull()
    expect(parseHostCommand({ type: 'openFolder', name: 'app', entry: 'main.py', folders: ['pkg'], files: { 'main.py': 'x=1' } }))
      .toEqual({ type: 'openFolder', name: 'app', entry: 'main.py', folders: ['pkg'], files: { 'main.py': 'x=1' } })
    expect(parseHostCommand({ type: 'openFolder', name: 'app', entry: 'missing.py', folders: [], files: { 'main.py': 'x=1' } })).toBeNull()
    expect(parseHostCommand({ type: 'syncFolder', name: 'app', entry: 'main.py', folders: [], files: { 'main.py': 'x=2' }, force: false }))
      .toEqual({ type: 'syncFolder', name: 'app', entry: 'main.py', folders: [], files: { 'main.py': 'x=2' }, force: false })
    expect(parseHostCommand({ type: 'syncFolder', name: 'app', entry: 'main.py', folders: [], files: { '../bad.py': 'x' }, force: true })).toBeNull()
    expect(parseHostCommand({ type: 'markFolderSaved', files: { 'main.py': 'x=2' } })).toEqual({ type: 'markFolderSaved', files: { 'main.py': 'x=2' } })
    expect(parseHostCommand({ type: 'setGlass', tint: 3 })).toEqual({ type: 'setGlass', tint: 1 })
    expect(parseHostCommand({ type: 'setGlass', tint: Number.NaN })).toBeNull()
    expect(parseHostCommand({ type: 'eval', code: 'alert(1)' })).toBeNull()
    expect(parseHostCommand('run')).toBeNull()
  })

  it('routes each command to its action and returns the code for Save', () => {
    const a = actions()
    expect(handleHostCommand({ type: 'run' }, a)).toEqual({ ok: true })
    expect(handleHostCommand({ type: 'stop' }, a)).toEqual({ ok: true })
    expect(handleHostCommand({ type: 'getCode' }, a)).toEqual({ ok: true, code: 'print(1)' })
    handleHostCommand({ type: 'openFile', name: 'grade.py', code: 'print(2)' }, a)
    handleHostCommand({ type: 'markSaved', code: 'print(2)' }, a)
    expect(a.run).toHaveBeenCalledOnce()
    expect(a.stop).toHaveBeenCalledOnce()
    expect(a.openFile).toHaveBeenCalledWith('grade.py', 'print(2)')
    expect(a.markSaved).toHaveBeenCalledWith('print(2)')
    expect(handleHostCommand({ type: 'nope' }, a)).toEqual({ ok: false, error: 'Unknown command' })
  })

  it('sets the page tint over the window blur', () => {
    handleHostCommand({ type: 'setGlass', tint: 0.4 }, actions())
    expect(document.documentElement.dataset.host).toBe('mac')
    expect(document.documentElement.style.getPropertyValue('--glass-tint')).toBe('0.4')
  })

  it('does nothing in a normal browser', () => {
    expect(isMacHost()).toBe(false)
    expect(() => postHostEvent({ type: 'theme', theme: 'dark' })).not.toThrow()
    installMacHost(actions)
    expect((window as unknown as { playgroundHost?: unknown }).playgroundHost).toBeUndefined()
  })

  it('installs the entry point and says it is ready inside the Mac app', () => {
    const postMessage = vi.fn()
    ;(window as unknown as { webkit: unknown }).webkit = { messageHandlers: { playgroundHost: { postMessage } } }
    const a = actions()
    const cleanup = installMacHost(() => a)
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready', version: 1 })
    const host = (window as unknown as { playgroundHost: { handle: (c: unknown) => unknown } }).playgroundHost
    expect(host.handle({ type: 'getCode' })).toEqual({ ok: true, code: 'print(1)' })
    cleanup()
    expect((window as unknown as { playgroundHost?: unknown }).playgroundHost).toBeUndefined()
  })
})
