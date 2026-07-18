/**
 * Browser-local settings (localStorage only). Never sent to a Python Live server.
 */

import {
  LOCAL_COMPANION_BASE,
  defaultCompanionBaseUrl,
  isPublicCompanionUrl,
} from './localApi'

export const SETTINGS_KEY = 'plp-settings-v1'

export type AppSettings = {
  /** Base URL for FastAPI companion (local or public HTTPS demo) */
  companionBaseUrl: string
  /**
   * Secret for companion (X-API-Key) and/or OpenAI-compatible LLM (Bearer).
   * Stored only in this browser. Public demo API usually needs no key.
   */
  apiKey: string
  /** OpenAI-compatible API root, e.g. https://api.openai.com/v1 or https://api.x.ai/v1 */
  llmBaseUrl: string
  /** Model id for the quiet LLM test */
  llmModel: string
}

export function defaultSettings(): AppSettings {
  return {
    companionBaseUrl: defaultCompanionBaseUrl(),
    apiKey: '',
    llmBaseUrl: '',
    llmModel: 'gpt-4o-mini',
  }
}

/** @deprecated use defaultSettings() */
export const DEFAULT_SETTINGS: AppSettings = {
  companionBaseUrl: LOCAL_COMPANION_BASE,
  apiKey: '',
  llmBaseUrl: '',
  llmModel: 'gpt-4o-mini',
}

export function loadSettings(): AppSettings {
  const defaults = defaultSettings()
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      companionBaseUrl:
        typeof parsed.companionBaseUrl === 'string' && parsed.companionBaseUrl.trim()
          ? parsed.companionBaseUrl.trim().replace(/\/$/, '')
          : defaults.companionBaseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      llmBaseUrl:
        typeof parsed.llmBaseUrl === 'string'
          ? parsed.llmBaseUrl.trim().replace(/\/$/, '')
          : '',
      llmModel:
        typeof parsed.llmModel === 'string' && parsed.llmModel.trim()
          ? parsed.llmModel.trim()
          : defaults.llmModel,
    }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return
  const defaults = defaultSettings()
  const next: AppSettings = {
    companionBaseUrl:
      settings.companionBaseUrl.trim().replace(/\/$/, '') ||
      defaults.companionBaseUrl,
    apiKey: settings.apiKey,
    llmBaseUrl: settings.llmBaseUrl.trim().replace(/\/$/, ''),
    llmModel: settings.llmModel.trim() || defaults.llmModel,
  }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
}

export function maskApiKey(key: string): string {
  const t = key.trim()
  if (t.length <= 8) return t ? '••••••••' : ''
  return `${t.slice(0, 3)}…${t.slice(-4)}`
}

export function companionModeLabel(url: string): 'demo' | 'local' | 'custom' {
  if (isPublicCompanionUrl(url)) return 'demo'
  try {
    const u = new URL(url)
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return 'local'
  } catch {
    // ignore
  }
  return 'custom'
}
