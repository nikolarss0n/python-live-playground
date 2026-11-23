import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWorkspace, PROJECT_STORAGE_KEY, starterProject } from './model'
import { isProjectPath, MAX_PROJECT_CHARS, MAX_PROJECT_FILES, projectFilesError } from './paths'
import { useProjectWorkspace } from './useProjectWorkspace'

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('project paths and restoration', () => {
  it.each(['', '/main.py', '../a.py', 'a/..', 'a//b', './a.py', 'a/', 'a\\b.py', 'a\0.py', 'a/__proto__/b', 'constructor', 'C:/x.py'])('rejects unsafe path %j', (path) => {
    expect(isProjectPath(path)).toBe(false)
  })

  it('validates files, directory collisions and size bounds before staging', () => {
    expect(projectFilesError({ 'mail_tools/__init__.py': '', 'data/a.csv': '', 'read me.md': '' })).toBeNull()
    expect(projectFilesError({ 'data/a/b.csv': '', data: '' })).toMatch(/folder/)
    expect(projectFilesError({ 'main.py': 'a'.repeat(MAX_PROJECT_CHARS + 1) })).toMatch(/character/)
    expect(projectFilesError(Object.fromEntries(Array.from({ length: MAX_PROJECT_FILES + 1 }, (_, i) => [String(i), ''])))).toMatch(/files/)
  })

  it('recovers invalid tabs and rejects damaged files or entry paths', () => {
    const project = starterProject()
    const serialize = (overrides: Record<string, unknown>) => JSON.stringify({ version: 1, enabled: true, project: { ...project, ...overrides } })
    expect(parseWorkspace(serialize({ activePath: 'lost', openPaths: ['lost', 'lost'] }))?.project.openPaths).toEqual([project.entry])
    expect(parseWorkspace(serialize({ files: { 'main.py': null } }))).toBeNull()
    expect(parseWorkspace(serialize({ entry: 'missing.py' }))).toBeNull()
  })
})

describe('local project workspace', () => {
  it('starts opt-in, saves edits across tab changes, and restores project and selection', () => {
    const hook = renderHook(useProjectWorkspace)
    const current = () => hook.result.current
    expect(current().enabled).toBe(false)
    expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBeNull()
    act(() => {
      current().setEnabled(true)
      expect(current().createFile('data/more.csv')).toBeNull()
      current().editFile('data/more.csv', 'one,two')
      current().openFile('main.py')
    })
    expect(current().dirtyPaths.has('data/more.csv')).toBe(true)
    expect(current().project.activePath).toBe('main.py')
    act(() => vi.advanceTimersByTime(400))
    expect(current().dirtyPaths.size).toBe(0)
    act(() => { current().closeFile('main.py'); current().openFile('data/more.csv') })
    hook.unmount()
    const restored = renderHook(useProjectWorkspace)
    expect(restored.result.current.enabled).toBe(true)
    expect(restored.result.current.project.activePath).toBe('data/more.csv')
    expect(restored.result.current.project.files['data/more.csv']).toBe('one,two')
    expect(restored.result.current.project.openPaths).not.toContain('main.py')
    expect(restored.result.current.project.files['main.py']).toContain('from mail_tools.mask')
  })

  it('keeps one tab open, supports reopening closed files, and rejects conflicting names', () => {
    const { result } = renderHook(useProjectWorkspace)
    act(() => {
      for (const path of result.current.project.openPaths) result.current.closeFile(path)
      expect(result.current.createFile('main.py')).toMatch(/exists/)
      expect(result.current.createFile('data')).toMatch(/folder/)
      expect(result.current.createFile('main.py/file')).toMatch(/folder/)
      expect(result.current.createFile('../secrets')).toMatch(/relative/)
    })
    expect(result.current.project.openPaths).toHaveLength(1)
    const finalTab = result.current.project.openPaths[0]
    expect(result.current.project.activePath).toBe(finalTab)
    act(() => result.current.openFile('main.py'))
    expect(result.current.project.openPaths).toEqual([finalTab, 'main.py'])
  })

  it('creates named projects and switches without losing files, selected tabs, or edits', () => {
    const hook = renderHook(useProjectWorkspace)
    const current = () => hook.result.current
    act(() => {
      current().setEnabled(true)
      current().editFile('main.py', 'print("first")')
      current().openFile('mail_tools/mask.py')
      expect(current().createProject(' Scratch ')).toBeNull()
      expect(current().createProject('scratch')).toMatch(/already/)
      expect(current().createProject('bad/name')).toMatch(/slashes/)
    })
    expect(current().projectNames).toEqual(['mail-tools', 'Scratch'])
    expect(current().project.openPaths).toEqual(['main.py'])
    act(() => {
      current().createFile('pkg/hello.py')
      current().editFile('pkg/hello.py', 'print("second")')
      current().switchProject('mail-tools')
    })
    expect(current().project.files['main.py']).toBe('print("first")')
    expect(current().project.activePath).toBe('mail_tools/mask.py')
    expect(current().dirtyPaths.size).toBe(0)
    hook.unmount()
    const restored = renderHook(useProjectWorkspace)
    expect(restored.result.current.project.name).toBe('mail-tools')
    act(() => restored.result.current.switchProject('Scratch'))
    expect(restored.result.current.project.activePath).toBe('pkg/hello.py')
    expect(restored.result.current.project.files['pkg/hello.py']).toBe('print("second")')
  })

  it('moves edited files and entry paths, preserving neighboring tabs and closed file state on reload', () => {
    const hook = renderHook(useProjectWorkspace)
    const { result } = hook
    act(() => {
      result.current.setEnabled(true)
      result.current.editFile('mail_tools/mask.py', 'print("updated")')
      expect(result.current.renameFile('mail_tools/mask.py', 'lib/helper.py')).toBeNull()
      expect(result.current.renameFile('main.py', 'run/entry.py')).toBeNull()
      expect(result.current.renameFile('mail_tools/__init__.py', 'lib/__init__.py')).toBeNull()
    })
    expect(result.current.dirtyPaths.has('lib/helper.py')).toBe(true)
    hook.unmount()
    const restored = renderHook(useProjectWorkspace)
    const project = restored.result.current.project
    expect(project.activePath).toBe('lib/helper.py')
    expect(project.entry).toBe('run/entry.py')
    expect(project.openPaths).toEqual(['run/entry.py', 'lib/helper.py', 'data/mails.csv'])
    expect(Object.keys(project.files)).toEqual(['run/entry.py', 'lib/__init__.py', 'lib/helper.py', 'data/mails.csv'])
    expect(project.files['lib/helper.py']).toBe('print("updated")')
  })

  it('leaves the workspace untouched when a move or entry change would make it invalid', () => {
    const { result } = renderHook(useProjectWorkspace)
    const original = result.current.project
    act(() => {
      expect(result.current.renameFile('missing', 'new.py')).toMatch(/no longer/)
      expect(result.current.renameFile('main.py', 'mail_tools/mask.py')).toMatch(/already/)
      expect(result.current.renameFile('main.py', 'main.txt')).toMatch(/extension/)
      expect(result.current.renameFile('mail_tools/mask.py', '../outside.py')).toMatch(/relative/)
      expect(result.current.renameFile('mail_tools/mask.py', 'data')).toMatch(/folder/)
      expect(result.current.renameFile('main.py', 'main.py')).toBeNull()
      expect(result.current.deleteFile('main.py')).toMatch(/entry/)
      expect(result.current.deleteFile('absent.py')).toMatch(/no longer/)
      expect(result.current.setEntry('data/mails.csv')).toMatch(/existing .py/)
      expect(result.current.setEntry('absent.py')).toMatch(/existing .py/)
    })
    expect(result.current.project).toBe(original)
  })

  it('deletes inactive and active files, reopening the entry when the last tab disappears', () => {
    const hook = renderHook(useProjectWorkspace)
    const { result } = hook
    act(() => {
      expect(result.current.setEntry('mail_tools/mask.py')).toBeNull()
      expect(result.current.deleteFile('mail_tools/__init__.py')).toBeNull()
      result.current.openFile('main.py')
      expect(result.current.deleteFile('main.py')).toBeNull()
    })
    expect(result.current.project.activePath).toBe('mail_tools/mask.py')
    expect(result.current.project.openPaths).toEqual(['mail_tools/mask.py', 'data/mails.csv'])
    act(() => {
      result.current.closeFile('mail_tools/mask.py')
      expect(result.current.deleteFile('data/mails.csv')).toBeNull()
    })
    hook.unmount()
    const restored = renderHook(useProjectWorkspace)
    expect(restored.result.current.project).toMatchObject({
      activePath: 'mail_tools/mask.py', entry: 'mail_tools/mask.py', openPaths: ['mail_tools/mask.py'],
    })
    expect(Object.keys(restored.result.current.project.files)).toEqual(['mail_tools/mask.py'])
  })

  it('flushes the latest edit immediately on page exit', () => {
    const { result } = renderHook(useProjectWorkspace)
    act(() => {
      result.current.setEnabled(true)
      result.current.editFile('main.py', 'latest')
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(parseWorkspace(localStorage.getItem(PROJECT_STORAGE_KEY) ?? '')?.project.files['main.py']).toBe('latest')
    expect(result.current.dirtyPaths.size).toBe(0)
  })

  it('reports failures and keeps unsaved edits dirty until a later save succeeds', () => {
    const { result } = renderHook(useProjectWorkspace)
    act(() => result.current.setEnabled(true))
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    act(() => { result.current.editFile('main.py', 'unsaved'); vi.advanceTimersByTime(400) })
    expect(result.current.saveNow()).toBe(false)
    expect(result.current.saveError).toMatch(/storage/i)
    expect(result.current.dirtyPaths.has('main.py')).toBe(true)
    save.mockRestore()
    act(() => { result.current.editFile('main.py', 'saved'); vi.advanceTimersByTime(400) })
    expect(result.current.saveError).toBeNull()
    expect(result.current.dirtyPaths.size).toBe(0)
  })

  it('protects a change saved by another tab while local edits are pending', () => {
    const { result } = renderHook(useProjectWorkspace)
    act(() => { result.current.setEnabled(true); result.current.editFile('main.py', 'mine') })
    const project = starterProject()
    project.files['main.py'] = 'theirs'
    const otherSave = JSON.stringify({ version: 1, enabled: true, project })
    localStorage.setItem(PROJECT_STORAGE_KEY, otherSave)
    act(() => vi.advanceTimersByTime(400))
    expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(otherSave)
    expect(result.current.project.files['main.py']).toBe('mine')
    expect(result.current.saveError).toMatch(/another tab/i)
  })
})

it('renames an entry folder atomically and protects it from recursive deletion', () => {
  const { result } = renderHook(useProjectWorkspace)
  act(() => {
    result.current.setEntry('mail_tools/mask.py')
    expect(result.current.renameFolder('mail_tools', 'lib')).toBeNull()
    expect(result.current.deleteFolder('lib')).toMatch(/entry/)
    expect(result.current.renameFolder('lib', 'main.py')).toMatch(/exists/)
  })
  expect(result.current.project.entry).toBe('lib/mask.py')
  expect(result.current.project.activePath).toBe('lib/mask.py')
  expect(result.current.project.files['lib/__init__.py']).toBe('')
})
