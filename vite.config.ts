/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { jevProxy } from './vite.jev.ts'
import { pythonWorkerCsp } from './vite.workerCsp.ts'
import type { Plugin } from 'vite'

/** The Mac app runs offline, so it drops the Google Fonts links and the font stacks fall back to SF Pro and SF Mono. */
function macOfflineHtml(): Plugin {
  return {
    name: 'python-live-mac-offline-html',
    transformIndexHtml: (html) => html.replace(/\s*<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, ''),
  }
}

// Node 25+ defines its own global localStorage, which shadows jsdom's and is undefined without --localstorage-file.
const testExecArgv = process.allowedNodeEnvironmentFlags.has('--experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : []

export default defineConfig(({ mode }) => ({
  plugins: [react(), pythonWorkerCsp(), ...(process.env.VITE_TARGET === 'mac' ? [macOfflineHtml()] : []), jevProxy({ ...loadEnv(mode, process.cwd(), 'TYPESAFE_'), ...process.env })],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    execArgv: testExecArgv,
  },
}))
