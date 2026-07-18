import { useEffect, useState } from 'react'
import type { AppSettings } from '../settings'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../settings'
import { testLlmCompletion } from '../llmClient'
import { checkLocalApiHealth } from '../localApi'

type SettingsModalProps = {
  open: boolean
  onClose: () => void
  onSaved?: (settings: AppSettings) => void
}

/**
 * Quiet settings: companion URL, API key, optional OpenAI-compatible LLM.
 * Keys stay in localStorage on this device only.
 */
export function SettingsModal({ open, onClose, onSaved }: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [showKey, setShowKey] = useState(false)
  const [companionNote, setCompanionNote] = useState<string | null>(null)
  const [llmNote, setLlmNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<'companion' | 'llm' | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(loadSettings())
      setCompanionNote(null)
      setLlmNote(null)
      setShowKey(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const save = () => {
    saveSettings(draft)
    onSaved?.(loadSettings())
    onClose()
  }

  const testCompanion = async () => {
    setBusy('companion')
    setCompanionNote(null)
    try {
      const ok = await checkLocalApiHealth({
        baseUrl: draft.companionBaseUrl,
        apiKey: draft.apiKey,
      })
      setCompanionNote(
        ok
          ? 'Companion reachable.'
          : 'Could not reach companion — is uvicorn running? Check URL / API key.',
      )
    } finally {
      setBusy(null)
    }
  }

  const testLlm = async () => {
    setBusy('llm')
    setLlmNote(null)
    try {
      const result = await testLlmCompletion({
        baseUrl: draft.llmBaseUrl,
        apiKey: draft.apiKey,
        model: draft.llmModel,
      })
      setLlmNote(
        result.ok
          ? `OK (${result.durationMs} ms): ${result.text}`
          : result.error,
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="settings-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <p className="settings-sub">
            Stored only in this browser. Never sent to a Python Live server.
          </p>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">API key</h3>
            <label className="settings-field">
              <span className="settings-label">Secret</span>
              <div className="settings-key-row">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="settings-input"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-… or companion key"
                  value={draft.apiKey}
                  onChange={(e) => update('apiKey', e.target.value)}
                  aria-label="API key"
                />
                <button
                  type="button"
                  className="btn btn-ghost settings-key-toggle"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <p className="settings-help">
              Used as <code>X-API-Key</code> / Bearer for the local companion, and
              as Bearer for an OpenAI-compatible model if you set a base URL below.
            </p>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Local FastAPI companion</h3>
            <label className="settings-field">
              <span className="settings-label">Base URL</span>
              <input
                type="url"
                className="settings-input"
                placeholder="http://127.0.0.1:8000"
                value={draft.companionBaseUrl}
                onChange={(e) => update('companionBaseUrl', e.target.value)}
                aria-label="Companion base URL"
              />
            </label>
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy != null}
                onClick={() => void testCompanion()}
              >
                {busy === 'companion' ? 'Testing…' : 'Test companion'}
              </button>
            </div>
            {companionNote ? (
              <p className="settings-note" role="status">
                {companionNote}
              </p>
            ) : null}
            <p className="settings-help">
              Run <code>npm run companion</code> after installing deps in{' '}
              <code>companion/</code>. Optional auth: set env{' '}
              <code>PLP_API_KEY</code> to match this key.
            </p>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Optional LLM (OpenAI-compatible)</h3>
            <label className="settings-field">
              <span className="settings-label">Base URL</span>
              <input
                type="url"
                className="settings-input"
                placeholder="https://api.openai.com/v1 or https://api.x.ai/v1"
                value={draft.llmBaseUrl}
                onChange={(e) => update('llmBaseUrl', e.target.value)}
                aria-label="LLM base URL"
              />
            </label>
            <label className="settings-field">
              <span className="settings-label">Model</span>
              <input
                type="text"
                className="settings-input"
                placeholder="gpt-4o-mini"
                value={draft.llmModel}
                onChange={(e) => update('llmModel', e.target.value)}
                aria-label="LLM model"
              />
            </label>
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy != null}
                onClick={() => void testLlm()}
              >
                {busy === 'llm' ? 'Testing…' : 'Test model'}
              </button>
            </div>
            {llmNote ? (
              <p className="settings-note" role="status">
                {llmNote}
              </p>
            ) : null}
            <p className="settings-help">
              One quiet test call only — no chat sidebar. Leave base URL empty to
              disable.
            </p>
          </section>
        </div>

        <footer className="settings-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}
