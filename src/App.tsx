import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { PlainScratchpad } from './PlainScratchpad'
import { SettingsModal } from './components/SettingsModal'
import type { Section } from './curriculum/sections'
import { linkedLessonId, readEnabledSections, writeEnabledSections } from './learningSwitches'
import { useProjectWorkspace } from './project/useProjectWorkspace'
import { loadSettings, type AppSettings } from './settings'
import { applyTheme, preferredTheme, type ThemeMode } from './theme'
import { writePreference } from './preferences'
import { postHostEvent, type DiskFolderPayload } from './host/macHost'
import './App.css'

const loadProjectPlayground = () =>
  import('./project/ProjectPlayground').then((mod) => ({ default: mod.ProjectPlayground }))

const loadLearningScratchpad = () =>
  import('./LearningScratchpad').then((mod) => ({ default: mod.LearningScratchpad }))

const ProjectPlayground = lazy(loadProjectPlayground)
const LearningScratchpad = lazy(loadLearningScratchpad)

function WorkspaceFallback() {
  return <div className="app-shell" aria-busy="true" />
}

export default function App() {
  const workspace = useProjectWorkspace()
  const [openedFromLink] = useState(() => Boolean(linkedLessonId()))
  const [mode, setMode] = useState(() => (workspace.enabled && !openedFromLink ? 'project' : 'scratchpad'))
  const [enabledSections, setEnabledSections] = useState(readEnabledSections)
  const [learningLoaded, setLearningLoaded] = useState(() => openedFromLink || enabledSections.size > 0)
  const [initialSection, setInitialSection] = useState<Section | null>(null)
  const [lastEnabledSection, setLastEnabledSection] = useState<Section | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(preferredTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings)
  const [allowModelTest, setAllowModelTest] = useState(true)
  const returnUrl = useRef<string | null>(null)
  const pendingFile = useRef<string | null>(null)

  useEffect(() => {
    applyTheme(theme)
    writePreference('plp-theme', theme)
    postHostEvent({ type: 'theme', theme })
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const openSettings = useCallback(() => {
    // Prefetch the curriculum bundle while Settings is open so toggling a section feels immediate.
    if (!learningLoaded) void loadLearningScratchpad()
    setSettingsOpen(true)
  }, [learningLoaded])

  const onToggleSection = useCallback((next: Section, on: boolean) => {
    const updated = new Set(enabledSections)
    if (on) updated.add(next)
    else updated.delete(next)
    setEnabledSections(updated)
    writeEnabledSections(updated)
    if (on) {
      setLastEnabledSection(next)
      if (!learningLoaded) {
        setInitialSection(next)
        setLearningLoaded(true)
      }
    }
  }, [enabledSections, learningLoaded])

  const takeOpenedFile = useCallback(() => {
    const file = pendingFile.current
    pendingFile.current = null
    return file
  }, [])

  const openProject = () => {
    returnUrl.current = window.location.href
    const url = new URL(window.location.href)
    url.searchParams.delete('lesson')
    if (url.hash.startsWith('#plp=')) url.hash = ''
    window.history.replaceState(null, '', url)
    workspace.setEnabled(true)
    setMode('project')
  }

  const openDiskFolder = (folder: DiskFolderPayload) => {
    returnUrl.current = window.location.href
    const url = new URL(window.location.href)
    url.searchParams.delete('lesson')
    if (url.hash.startsWith('#plp=')) url.hash = ''
    window.history.replaceState(null, '', url)
    workspace.openDiskFolder(folder)
    setMode('project')
  }

  const openScratchpad = (file?: string) => {
    pendingFile.current = file ?? null
    if (returnUrl.current) window.history.replaceState(null, '', returnUrl.current)
    workspace.closeDiskFolder()
    workspace.setEnabled(false)
    setMode('scratchpad')
  }

  if (mode === 'project') {
    return (
      <Suspense fallback={<WorkspaceFallback />}>
        <ProjectPlayground
          key={(workspace.isDiskBacked ? 'disk:' : 'local:') + workspace.project.name}
          workspace={workspace}
          onExit={openScratchpad}
        />
      </Suspense>
    )
  }

  return (
    <>
      {learningLoaded ? (
        <Suspense fallback={<WorkspaceFallback />}>
          <LearningScratchpad
            onOpenProject={openProject}
            onOpenDiskFolder={openDiskFolder}
            takeOpenedFile={takeOpenedFile}
            openedFromLink={openedFromLink}
            enabledSections={enabledSections}
            lastEnabledSection={lastEnabledSection}
            initialSection={initialSection}
            theme={theme}
            onToggleTheme={toggleTheme}
            appSettings={appSettings}
            onOpenSettings={openSettings}
            onAllowModelTestChange={setAllowModelTest}
          />
        </Suspense>
      ) : (
        <PlainScratchpad
          onOpenProject={openProject}
          onOpenDiskFolder={openDiskFolder}
          takeOpenedFile={takeOpenedFile}
          theme={theme}
          onToggleTheme={toggleTheme}
          appSettings={appSettings}
          onOpenSettings={openSettings}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        allowModelTest={learningLoaded ? allowModelTest : true}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setAppSettings(s)}
        learning={{ enabled: enabledSections, onToggle: onToggleSection }}
      />
    </>
  )
}
