import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { renderApp } = vi.hoisted(() => ({ renderApp: vi.fn() }))
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: renderApp }) }))
vi.mock('./App.tsx', () => ({ default: () => null }))

beforeEach(() => {
  vi.resetModules()
  renderApp.mockReset()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.getElementById('root')?.remove()
})

describe('initial document theme', () => {
  it.each([
    { stored: 'dark', systemDark: false, expected: 'dark' },
    { stored: 'light', systemDark: true, expected: 'light' },
    { stored: null, systemDark: true, expected: 'dark' },
  ])('applies $expected before scheduling the first App render (stored $stored)', async ({ stored, systemDark, expected }) => {
    if (stored) localStorage.setItem('plp-theme', stored)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    vi.spyOn(window, 'matchMedia').mockReturnValue({ ...media, matches: systemDark })
    renderApp.mockImplementation(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', expected)
    })
    await import('./main')
    expect(renderApp).toHaveBeenCalledOnce()
  })
})
