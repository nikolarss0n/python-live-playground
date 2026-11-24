import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiskFolderPayload } from '../host/macHost'
import {
  closeProjectTab, deleteProjectFolder, deleteProjectFile, openProjectFile, parseWorkspace, projectNameError,
  PROJECT_STORAGE_KEY, renameProjectFolder, renameProjectFile, setProjectEntry, starterProject, type Project, type WorkspaceSnapshot,
} from './model'
import { projectFilesError, projectFolders, isProjectPath } from './paths'

type DiskSession = {
  project: Project
  /** Last snapshot known to be on disk; differs from `project.files` only for unsaved local edits. */
  diskFiles: Record<string, string>
}

function projectFromDiskFolder(folder: DiskFolderPayload): Project {
  const files = { ...folder.files }
  return {
    name: folder.name,
    entry: folder.entry,
    folders: projectFolders(files, folder.folders),
    files,
    activePath: folder.entry,
    openPaths: [folder.entry],
  }
}

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
  const [diskSession, setDiskSession] = useState<DiskSession | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const latest = useRef(snapshot)
  const saved = useRef(snapshot)
  const diskRef = useRef<DiskSession | null>(null)
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

  function activeProject(): Project {
    return diskRef.current?.project ?? latest.current.project
  }

  function changeProject(project: Project | string): string | null {
    if (typeof project === 'string') return project
    if (diskRef.current) {
      if (project !== diskRef.current.project) {
        const next = { ...diskRef.current, project }
        diskRef.current = next
        setDiskSession(next)
      }
      return null
    }
    if (project !== latest.current.project) update({ ...latest.current, project })
    return null
  }

  function editFile(path: string, content: string) {
    const current = activeProject()
    if (!Object.hasOwn(current.files, path) || current.files[path] === content) return
    changeProject({ ...current, files: { ...current.files, [path]: content } })
  }

  function createFile(path: string): string | null {
    const current = activeProject()
    if (Object.hasOwn(current.files, path)) return 'A file already exists at this path.'
    const files = { ...current.files, [path]: '' }
    const error = projectFilesError(files, current.folders)
    if (error) return error
    changeProject(openProjectFile({ ...current, files, folders: projectFolders(files, current.folders) }, path))
    return null
  }

  function createFolder(path: string): string | null {
    const current = activeProject()
    if (!isProjectPath(path)) return 'Enter a relative folder name without empty or parent segments.'
    if (current.folders.includes(path)) return 'A folder already exists at this path.'
    const folders = projectFolders(current.files, [...current.folders, path])
    const error = projectFilesError(current.files, folders)
    if (error) return error
    return changeProject({ ...current, folders })
  }

  const openDiskFolder = useCallback((folder: DiskFolderPayload) => {
    const next: DiskSession = { project: projectFromDiskFolder(folder), diskFiles: { ...folder.files } }
    diskRef.current = next
    setDiskSession(next)
    setSaveError(null)
  }, [])

  const syncDiskFolder = useCallback((folder: DiskFolderPayload, force: boolean) => {
    const existing = diskRef.current
    if (!existing) {
      openDiskFolder(folder)
      return
    }
    const nextFiles: Record<string, string> = { ...folder.files }
    if (!force) {
      for (const [path, content] of Object.entries(existing.project.files)) {
        // Keep unsaved local edits or locally created files instead of silently clobbering them.
        if (existing.diskFiles[path] !== content) nextFiles[path] = content
      }
    }
    const nextFolders = projectFolders(nextFiles, folder.folders)
    const entry = Object.hasOwn(nextFiles, existing.project.entry) && existing.project.entry.endsWith('.py')
      ? existing.project.entry
      : folder.entry
    const openPaths = existing.project.openPaths.filter((path) => Object.hasOwn(nextFiles, path))
    if (!openPaths.length) openPaths.push(entry)
    const activePath = openPaths.includes(existing.project.activePath) ? existing.project.activePath : openPaths[0]
    const next: DiskSession = {
      project: { name: folder.name, entry, folders: nextFolders, files: nextFiles, activePath, openPaths },
      diskFiles: { ...folder.files },
    }
    diskRef.current = next
    setDiskSession(next)
  }, [openDiskFolder])

  const markDiskSaved = useCallback((savedFiles: Record<string, string>) => {
    const existing = diskRef.current
    if (!existing) return
    const next: DiskSession = { ...existing, diskFiles: { ...existing.diskFiles, ...savedFiles } }
    diskRef.current = next
    setDiskSession(next)
  }, [])

  const closeDiskFolder = useCallback(() => {
    diskRef.current = null
    setDiskSession(null)
  }, [])

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
    closeDiskFolder()
    update({ enabled: true, project, otherProjects })
    flush()
    return null
  }

  function switchProject(name: string) {
    const current = latest.current
    if (diskRef.current) {
      if (current.project.name === name) {
        closeDiskFolder()
        return
      }
      const found = current.otherProjects.find((item) => item.name === name)
      if (!found) return
      closeDiskFolder()
      update({ enabled: true, project: found, otherProjects: [current.project, ...current.otherProjects.filter((item) => item !== found)] })
      flush()
      return
    }
    const project = current.otherProjects.find((item) => item.name === name)
    if (!project) return
    update({ enabled: true, project, otherProjects: [current.project, ...current.otherProjects.filter((item) => item !== project)] })
    flush()
  }

  function resetStarter() {
    if (diskRef.current) return
    const current = latest.current
    if (current.project.name !== 'mail-tools') return
    update({ ...current, project: starterProject() })
    flush()
  }

  const isDiskBacked = diskSession !== null
  const project = diskSession?.project ?? snapshot.project
  const { enabled } = snapshot
  const projectNames = [snapshot.project, ...snapshot.otherProjects].map((item) => item.name).sort((a, b) => a.localeCompare(b))
  const savedProject = savedSnapshot.project.name === project.name ? savedSnapshot.project : savedSnapshot.otherProjects.find((item) => item.name === project.name)
  const baselineFiles = diskSession ? diskSession.diskFiles : (savedProject?.files ?? {})
  const dirtyEntries = Object.entries(project.files).filter(([path, content]) => content !== baselineFiles[path])
  const dirtyPaths: ReadonlySet<string> = new Set(dirtyEntries.map(([path]) => path))
  const dirtyFiles: Record<string, string> = Object.fromEntries(dirtyEntries)
  return {
    project, enabled, isDiskBacked, setEnabled, createFile, createFolder, editFile, dirtyPaths, dirtyFiles, saveError, projectNames,
    createProject, switchProject, resetStarter, openDiskFolder, syncDiskFolder, markDiskSaved, closeDiskFolder, saveNow: flush,
    renameFolder: (path: string, name: string) => changeProject(renameProjectFolder(activeProject(), path, name)),
    deleteFolder: (path: string) => changeProject(deleteProjectFolder(activeProject(), path)),
    renameFile: (path: string, newPath: string) => changeProject(renameProjectFile(activeProject(), path, newPath)),
    deleteFile: (path: string) => changeProject(deleteProjectFile(activeProject(), path)),
    setEntry: (path: string) => changeProject(setProjectEntry(activeProject(), path)),
    openFile: (path: string) => { changeProject(openProjectFile(activeProject(), path)) },
    closeFile: (path: string) => { changeProject(closeProjectTab(activeProject(), path)) },
  }
}

export type ProjectWorkspace = ReturnType<typeof useProjectWorkspace>
