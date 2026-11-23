/**
 * The typed protocol between the web app and the macOS shell (macos/). The shell calls
 * `window.playgroundHost.handle(command)`; the page tells the shell about itself through the `playgroundHost`
 * WebKit message handler. In a normal browser neither side exists and nothing here runs.
 */

export const HOST_PROTOCOL_VERSION = 1

export type HostCommand =
  | { type: 'run' }
  | { type: 'stop' }
  | { type: 'getCode' }
  | { type: 'openFile'; name: string; code: string }
  | { type: 'markSaved'; code: string }
  | { type: 'setGlass'; tint: number }

export type HostEvent =
  | { type: 'ready'; version: number }
  | { type: 'theme'; theme: 'light' | 'dark' }
  | { type: 'dirty'; dirty: boolean }

type ProjectDocument = { name: string; saved: boolean }
export type HostReply = { ok: true; code?: string; projectDocument?: ProjectDocument } | { ok: false; error: string }

export type HostActions = {
  run: () => void
  stop: () => void
  projectDocument?: () => ProjectDocument
  getCode: () => string
  openFile: (name: string, code: string) => void
  markSaved?: (code: string) => void
}

/** The largest file the app will open, matching the share-link guard. */
export const MAX_OPEN_FILE_CHARS = 80_000

type MessageHandler = { postMessage: (message: unknown) => void }
type HostWindow = Window & {
  webkit?: { messageHandlers?: { playgroundHost?: MessageHandler } }
  playgroundHost?: { handle: (command: unknown) => HostReply }
}

function handler(win: HostWindow): MessageHandler | null {
  return win.webkit?.messageHandlers?.playgroundHost ?? null
}

export function isMacHost(win: Window = window): boolean {
  return handler(win as HostWindow) !== null
}

export function postHostEvent(event: HostEvent, win: Window = window): void {
  handler(win as HostWindow)?.postMessage(event)
}

/** Rebuilds a command field by field; anything unexpected is refused rather than trusted. */
export function parseHostCommand(value: unknown): HostCommand | null {
  if (typeof value !== 'object' || value === null) return null
  const command = value as Record<string, unknown>
  switch (command.type) {
    case 'run':
    case 'stop':
    case 'getCode':
      return { type: command.type }
    case 'openFile':
      if (typeof command.name !== 'string' || typeof command.code !== 'string') return null
      if (command.code.length > MAX_OPEN_FILE_CHARS) return null
      return { type: 'openFile', name: command.name.slice(0, 255), code: command.code }
    case 'markSaved':
      if (typeof command.code !== 'string' || command.code.length > MAX_OPEN_FILE_CHARS) return null
      return { type: 'markSaved', code: command.code }
    case 'setGlass':
      if (typeof command.tint !== 'number' || !Number.isFinite(command.tint)) return null
      return { type: 'setGlass', tint: Math.min(1, Math.max(0, command.tint)) }
    default:
      return null
  }
}

/** The page-background opacity over the window blur; 1 is a solid page. */
export function applyGlassTint(tint: number, root: HTMLElement = document.documentElement): void {
  root.dataset.host = 'mac'
  root.style.setProperty('--glass-tint', String(tint))
}

export function handleHostCommand(value: unknown, actions: HostActions): HostReply {
  const command = parseHostCommand(value)
  if (!command) return { ok: false, error: 'Unknown command' }
  switch (command.type) {
    case 'run': actions.run(); return { ok: true }
    case 'stop': actions.stop(); return { ok: true }
    case 'getCode': return {
      ok: true, code: actions.getCode(),
      ...(actions.projectDocument && { projectDocument: actions.projectDocument() }),
    }
    case 'openFile': actions.openFile(command.name, command.code); return { ok: true }
    case 'markSaved': actions.markSaved?.(command.code); return { ok: true }
    case 'setGlass': applyGlassTint(command.tint); return { ok: true }
  }
}

/** Installs the command entry point while the app is mounted. Returns the cleanup. */
export function installMacHost(actions: () => HostActions, win: Window = window): () => void {
  const hostWindow = win as HostWindow
  if (!handler(hostWindow)) return () => {}
  hostWindow.playgroundHost = { handle: (command) => handleHostCommand(command, actions()) }
  postHostEvent({ type: 'ready', version: HOST_PROTOCOL_VERSION }, win)
  return () => { delete hostWindow.playgroundHost }
}
