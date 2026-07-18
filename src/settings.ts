/**
 * Browser-local settings (localStorage only). Never sent to a Python Live server.
 */

import { DEFAULT_LOCAL_API_BASE } from './localApi'

export const SETTINGS_KEY = 'plp-settings-v1'

export type AppSettings = {
  /** Base URL for optional FastAPI companion */
  companionBaseUrl: string
  /**
   * Secret for companion (X-API-Key) and/or OpenAI-compatible LLM (Bearer).
   * Stored only in this browser.
   */
  apiKey: string
  /** OpenAI-compatible API root, e.g. https://api.openai.com/v1 or https://api.x.ai/v1 */
  llmBaseUrl: string
  /** Model id for the quiet LLM test */
  llmModel: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  companionBaseUrl: DEFAULT_LOCAL_API_BASE,
  apiKey: '',
  llmBaseUrl: '',
  llmModel: 'gpt-4o-mini',
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      companionBaseUrl:
        typeof parsed.companionBaseUrl === 'string' && parsed.companionBaseUrl.trim()
          ? parsed.companionBaseUrl.trim().replace(/\/$/, '')
          : DEFAULT_SETTINGS.companionBaseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      llmBaseUrl:
        typeof parsed.llmBaseUrl === 'string'
          ? parsed.llmBaseUrl.trim().replace(/\/$/, '')
          : '',
      llmModel:
        typeof parsed.llmModel === 'string' && parsed.llmModel.trim()
          ? parsed.llmModel.trim()
          : DEFAULT_SETTINGS.llmModel,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return
  const next: AppSettings = {
    companionBaseUrl:
      settings.companionBaseUrl.trim().replace(/\/$/, '') ||
      DEFAULT_SETTINGS.companionBaseUrl,
    apiKey: settings.apiKey,
    llmBaseUrl: settings.llmBaseUrl.trim().replace(/\/$/, ''),
    llmModel: settings.llmModel.trim() || DEFAULT_SETTINGS.llmModel,
  }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
}

export function maskApiKey(key: string): string {
  const t = key.trim()
  if (t.length <= 8) return t ? '••••••••' : ''
  return `${t.slice(0, 3)}…${t.slice(-4)}`
}
