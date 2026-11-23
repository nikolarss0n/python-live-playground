import { useCallback, useEffect, useRef, useState } from 'react'
import {
  closeProjectTab, deleteProjectFolder, deleteProjectFile, openProjectFile, parseWorkspace, projectNameError,
  PROJECT_STORAGE_KEY, renameProjectFolder, renameProjectFile, setProjectEntry, starterProject, type Project, type WorkspaceSnapshot,
} from './model'
import { projectFilesError, projectFolders, isProjectPath } from './paths'

function loadWorkspace() {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(PROJECT_STORAGE_KEY)
  } catch {
    // Storage can be disabled; edits can still be used in this session.
  }
  const saved = raw === null ? null : parseWorkspace(raw)
  return {
    raw,
    damaged: raw !== null && saved === null,
    snapshot: saved ?? { enabled: false, project: starterProject(), otherProjects: [] },
  }
}

export function useProjectWorkspace() {
  const [initial] = useState(loadWorkspace)
  const [snapshot, setSnapshot] = useState(initial.snapshot)
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot)
  const [saveError, setSaveError] = useState<string | null>(null)
  const latest = useRef(snapshot)
  const saved = useRef(snapshot)
  const raw = useRef(initial.raw)
  const damaged = useRef(initial.damaged)
  const timer = useRef<number | undefined>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const next = latest.current
    if (next === saved.current) return true
    for (const project of [next.project, ...next.otherProjects]) {
      const error = projectFilesError(project.files, project.folders)
      if (error) { setSaveError(project.name + ' — ' + error); return false }
    }
    try {
      const storage = window.localStorage
      if (storage.getItem(PROJECT_STORAGE_KEY) !== raw.current) {
        setSaveError('Another tab changed this project. Copy your unsaved edits before reloading.')
        return false
      }
      if (damaged.current && raw.current !== null) {
        storage.setItem(PROJECT_STORAGE_KEY + '-damaged', raw.current)
      }
      const serialized = JSON.stringify({ version: 1, ...next })
      storage.setItem(PROJECT_STORAGE_KEY, serialized)
      raw.current = serialized
      damaged.current = false
      saved.current = next
      setSavedSnapshot(next)
      setSaveError(null)
      return true
    } catch {
      setSaveError('Local storage is unavailable or full. Your edits are only in this tab.')
      return false
    }
  }, [])

  const update = useCallback((next: WorkspaceSnapshot) => {
    if (next === latest.current) return
    latest.current = next
    setSnapshot(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 350)
  }, [flush])

  useEffect(() => {
    function syncSavedWorkspace(event: StorageEvent) {
      if (event.key !== PROJECT_STORAGE_KEY || event.storageArea !== window.localStorage) return
      if (saved.current !== latest.current) { flush(); return }
      const next = event.newValue ? parseWorkspace(event.newValue) : null
      if (!next) return
      raw.current = event.newValue
      damaged.current = false
      latest.current = saved.current = next
      setSnapshot(next)
      setSavedSnapshot(next)
      setSaveError(null)
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('storage', syncSavedWorkspace)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('storage', syncSavedWorkspace)
      flush()
    }
  }, [flush])

  function changeProject(project: Project | string): string | null {
    if (typeof project === 'string') return project
    if (project !== latest.current.project) update({ ...latest.current, project })
    return null
  }

  function editFile(path: string, content: string) {
    const current = latest.current.project
    if (!Object.hasOwn(current.files, path) || current.files[path] === content) return
    changeProject({ ...current, files: { ...current.files, [path]: content } })
  }

  function createFile(path: string): string | null {
    const current = latest.current.project
    if (Object.hasOwn(current.files, path)) return 'A file already exists at this path.'
    const files = { ...current.files, [path]: '' }
    const error = projectFilesError(files, current.folders)
    if (error) return error
    changeProject(openProjectFile({ ...current, files, folders: projectFolders(files, current.folders) }, path))
    return null
  }

  function createFolder(path: string): string | null {
    const current = latest.current.project
    if (!isProjectPath(path)) return 'Enter a relative folder name without empty or parent segments.'
    if (current.folders.includes(path)) return 'A folder already exists at this path.'
    const folders = projectFolders(current.files, [...current.folders, path])
    const error = projectFilesError(current.files, folders)
    if (error) return error
    return changeProject({ ...current, folders })
  }

  function setEnabled(enabled: boolean) {
    if (enabled !== latest.current.enabled) {
      update({ ...latest.current, enabled })
      flush()
    }
  }

  function createProject(input: string): string | null {
    const current = latest.current
    const name = input.trim()
    const otherProjects = [current.project, ...current.otherProjects]
    const error = projectNameError(name, otherProjects.map((item) => item.name))
    if (error) return error
    const entry = 'main.py'
    const project = { name, entry, folders: [], activePath: entry, openPaths: [entry], files: { [entry]: 'print("Hello, Python!")\n' } }
    update({ enabled: true, project, otherProjects })
    flush()
    return null
  }

  function switchProject(name: string) {
    const current = latest.current
    const project = current.otherProjects.find((item) => item.name === name)
    if (!project) return
    update({ enabled: true, project, otherProjects: [current.project, ...current.otherProjects.filter((item) => item !== project)] })
    flush()
  }

  const { project, enabled } = snapshot
  const projectNames = [project, ...snapshot.otherProjects].map((item) => item.name).sort((a, b) => a.localeCompare(b))
  const savedProject = savedSnapshot.project.name === project.name ? savedSnapshot.project : savedSnapshot.otherProjects.find((item) => item.name === project.name)
  const savedFiles = savedProject?.files ?? {}
  const dirtyPaths: ReadonlySet<string> = new Set(Object.keys(project.files).filter((path) => project.files[path] !== savedFiles[path]))
  return {
    project, enabled, setEnabled, createFile, createFolder, editFile, dirtyPaths, saveError, projectNames, createProject, switchProject, saveNow: flush,
    renameFolder: (path: string, name: string) => changeProject(renameProjectFolder(latest.current.project, path, name)),
    deleteFolder: (path: string) => changeProject(deleteProjectFolder(latest.current.project, path)),
    renameFile: (path: string, newPath: string) => changeProject(renameProjectFile(latest.current.project, path, newPath)),
    deleteFile: (path: string) => changeProject(deleteProjectFile(latest.current.project, path)),
    setEntry: (path: string) => changeProject(setProjectEntry(latest.current.project, path)),
    openFile: (path: string) => { changeProject(openProjectFile(latest.current.project, path)) },
    closeFile: (path: string) => { changeProject(closeProjectTab(latest.current.project, path)) },
  }
}

export type ProjectWorkspace = ReturnType<typeof useProjectWorkspace>
