import { describe, expect, it, beforeEach } from 'vitest'
import {
  companionModeLabel,
  defaultSettings,
  loadSettings,
  maskApiKey,
  saveSettings,
  SETTINGS_KEY,
} from './settings'

describe('settings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('loads defaults when empty', () => {
    expect(loadSettings()).toEqual(defaultSettings())
  })

  it('labels companion URLs', () => {
    expect(companionModeLabel('https://api.example.com')).toBe('demo')
    expect(companionModeLabel('http://127.0.0.1:8000')).toBe('local')
  })

  it('round-trips save/load', () => {
    saveSettings({
      companionBaseUrl: 'http://127.0.0.1:9000/',
      apiKey: 'sk-test-123456',
      llmBaseUrl: 'https://api.openai.com/v1/',
      llmModel: 'gpt-4o-mini',
    })
    const loaded = loadSettings()
    expect(loaded.companionBaseUrl).toBe('http://127.0.0.1:9000')
    expect(loaded.apiKey).toBe('sk-test-123456')
    expect(loaded.llmBaseUrl).toBe('https://api.openai.com/v1')
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBeTruthy()
  })

  it('masks keys for display', () => {
    expect(maskApiKey('')).toBe('')
    expect(maskApiKey('sk-abcdefghijklmnop')).toMatch(/^sk-…/)
  })
})
