/**
 * Headless verification of browser-local Python execution.
 * Usage: node scripts/verify-execution.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = path.resolve('refs/verify')

async function waitForStatus(page, text, timeout = 90_000) {
  await page.locator('.status-label').filter({ hasText: text }).waitFor({
    timeout,
  })
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  console.log('→ open', baseUrl)
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.app-shell', { timeout: 15_000 })

  // Boot Pyodide (CDN download on first run)
  console.log('→ waiting for Python ready…')
  await page.locator('.status-label').waitFor({ timeout: 5000 })
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.status-label')
      return el && !/Loading Python/i.test(el.textContent || '')
    },
    null,
    { timeout: 120_000 },
  )
  console.log('  status:', await page.locator('.status-label').innerText())

  // Default example should auto-run
  await page.waitForTimeout(800)
  await page.locator('.results-body').waitFor()
  // Click Run to force
  await page.getByRole('button', { name: 'Run' }).click()
  await page.waitForFunction(
    () => {
      const body = document.querySelector('.results-body')
      return body && /Hello/.test(body.textContent || '')
    },
    null,
    { timeout: 60_000 },
  )
  const afterHello = await page.locator('.results-body').innerText()
  console.log('✓ print output:\n', afterHello.slice(0, 200))
  if (!/Hello/.test(afterHello)) throw new Error('Expected Hello print output')

  await page.screenshot({
    path: path.join(outDir, 'desktop-success.png'),
    fullPage: true,
  })

  // Expression-only program
  await page.evaluate(() => {
    // Prefer setting via React is hard; use CodeMirror contenteditable path
  })
  // Load errors example via select
  await page.getByLabel('Load an example').selectOption('errors')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Run' }).click()
  await page.waitForFunction(
    () => {
      const body = document.querySelector('.results-body')
      return body && /ZeroDivision|division/i.test(body.textContent || '')
    },
    null,
    { timeout: 30_000 },
  )
  console.log('✓ runtime error shown')

  // Infinite loop → Stop
  await page.getByLabel('Load an example').selectOption('infinite')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Run' }).click()
  await waitForStatus(page, 'Running', 15_000)
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.status-label')
      const t = el?.textContent || ''
      return /Stopped|Ready|Done/i.test(t)
    },
    null,
    { timeout: 30_000 },
  )
  console.log('✓ stop recovered:', await page.locator('.status-label').innerText())

  // Timeout path — hang without Stop
  await page.getByLabel('Load an example').selectOption('infinite')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Run' }).click()
  await page.waitForFunction(
    () => {
      const body = document.querySelector('.results-body')
      const status = document.querySelector('.status-label')?.textContent || ''
      return (
        /Timed out|Timeout/i.test(status) ||
        /Timeout|too long|time limit/i.test(body?.textContent || '')
      )
    },
    null,
    { timeout: 20_000 },
  )
  console.log('✓ timeout recovered')

  // Narrow width screenshot
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('Load an example').selectOption('hello')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Run' }).click()
  await page.waitForTimeout(1500)
  await page.screenshot({
    path: path.join(outDir, 'narrow-success.png'),
    fullPage: true,
  })

  // Dark theme
  await page.setViewportSize({ width: 1440, height: 900 })
  const themeBtn = page.getByRole('button', {
    name: /switch to (dark|light) theme/i,
  })
  await themeBtn.click()
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(outDir, 'desktop-dark.png'),
    fullPage: true,
  })

  console.log('All execution checks passed.')
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
