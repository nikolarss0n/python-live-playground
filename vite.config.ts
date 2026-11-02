/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { jevProxy } from './vite.jev.ts'

// Node 25+ defines its own global localStorage, which shadows jsdom's and is undefined without --localstorage-file.
const testExecArgv = process.allowedNodeEnvironmentFlags.has('--experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : []

export default defineConfig(({ mode }) => ({
  plugins: [react(), jevProxy({ ...loadEnv(mode, process.cwd(), 'TYPESAFE_'), ...process.env })],
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
