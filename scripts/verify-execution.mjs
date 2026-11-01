/**
 * Headless verification of browser-local Python execution.
 * Usage: node scripts/verify-execution.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const argumentsList = process.argv.slice(2)
const desktopOnly = argumentsList.includes('--desktop-only')
const baseUrl = argumentsList.find((value) => !value.startsWith('--')) ?? 'http://127.0.0.1:5173'
const outDir = path.resolve('refs/verify')

async function waitForStatus(page, text, timeout = 90_000) {
  await page.locator('.status-label').filter({ hasText: text }).waitFor({
    timeout,
  })
}

async function replaceCode(page, code) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
  await page.keyboard.press('ControlOrMeta+Enter')
}

async function assertNoHorizontalOverflow(page, label) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  if (scrollWidth > clientWidth + 1) {
    throw new Error(`${label} overflows horizontally: ${scrollWidth} > ${clientWidth}`)
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  console.log('→ open', baseUrl)
  await page.goto(new URL('/?lesson=printing', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.app-shell', { timeout: 15_000 })

  // Boot Pyodide (CDN download on first run)
  console.log('→ waiting for Python ready…')
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.status-label')
      return !el || !/Loading Python/i.test(el.textContent || '')
    },
    null,
    { timeout: 120_000 },
  )
  console.log('  Python worker initialized')

  // Complete a tiny program and force a fresh run through the real editor.
  await page.locator('.results-body').waitFor()
  await replaceCode(page, 'print("Hello from browser verification")\n2 + 2\n')
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

  // The longest new lesson must still preserve the quiet hierarchy.
  await page.getByLabel('Choose learning track').selectOption('ml')
  await page.getByLabel('Choose a lesson').selectOption('ai-local-rag-capstone')
  await page.waitForFunction(
    () => /Local lexical RAG capstone/i.test(document.querySelector('.cm-content')?.textContent || ''),
    null,
    { timeout: 10_000 },
  )
  await page.screenshot({
    path: path.join(outDir, 'curriculum-desktop.png'),
    fullPage: true,
  })
  if (!desktopOnly) {
    await page.setViewportSize({ width: 390, height: 844 })
    await assertNoHorizontalOverflow(page, 'RAG capstone at 390px')
    await page.screenshot({
      path: path.join(outDir, 'curriculum-narrow.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1440, height: 900 })
  }

  // Complete one study-book parity lesson through the real Pyodide worker.
  await page.getByLabel('Choose a lesson').selectOption('ai-markov-chains')
  await page.waitForFunction(
    () => /Markov chains from transitions to PageRank/i.test(document.querySelector('.cm-content')?.textContent || ''),
    null,
    { timeout: 10_000 },
  )
  const markovStarter = await page.locator('.cm-content').innerText()
  const markovSolution = markovStarter
    .replace('???', 'TRANSITIONS[current]')
    .replace('???', '"random surfer with damping"')
    .replace('???', '"attention over the context window"')
    .replace('???', '0.85')
  await replaceCode(page, markovSolution)
  await page.waitForFunction(
    () => {
      const body = document.querySelector('.results-body')
      const goal = document.querySelector('.lesson-goal')
      return (
        /PageRank damping\s*0\.85/i.test(body?.textContent || '') &&
        /4\/4/.test(goal?.textContent || '')
      )
    },
    null,
    { timeout: 30_000 },
  )
  console.log('✓ study-book Markov lesson completed')

  await page.getByLabel('Choose learning track').selectOption('python')

  // Load the deliberate error lesson through the current lesson selector.
  await page.getByLabel('Choose a lesson').selectOption('errors')
  await replaceCode(page, 'a = 10\nb = 0\na / b\n')
  await page.waitForFunction(
    () => {
      const body = document.querySelector('.results-body')
      return body && /ZeroDivision|division/i.test(body.textContent || '')
    },
    null,
    { timeout: 30_000 },
  )
  console.log('✓ runtime error shown')

  // Async lesson — proves the worker uses Pyodide's promising entrypoint.
  await page.getByLabel('Choose learning track').selectOption('python')
  await page.getByLabel('Choose a lesson').selectOption('mid-async-timeouts-retries')
  await page.waitForFunction(
    () => /Async timeouts/i.test(document.querySelector('.cm-content')?.textContent || ''),
    null,
    { timeout: 10_000 },
  )
  const asyncStarter = await page.locator('.cm-content').innerText()
  const asyncSolution = asyncStarter
    .replace('???', '1')
    .replace('???', 'ProviderTimeout')
    .replace('???', '"fallback"')
  await replaceCode(page, asyncSolution)
  await page.waitForTimeout(2_000)
  const asyncOutput = await page.locator('.results-body').innerText()
  if (
    !/Recovered:\s*ok/i.test(asyncOutput) ||
    !/Exhausted:\s*fallback/i.test(asyncOutput)
  ) {
    throw new Error(`Async lesson did not complete:\n${asyncOutput}`)
  }
  console.log('✓ async timeout/retry lesson completed')

  // Infinite loop → Stop
  await page.getByLabel('Choose learning track').selectOption('python')
  await page.getByLabel('Choose a lesson').selectOption('infinite')
  await replaceCode(page, 'while True:\n    pass\n')
  await waitForStatus(page, 'Running', 15_000)
  await page.keyboard.press('Escape')
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
  await replaceCode(page, 'while True:\n    pass\n')
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

  // Recover after timeout at the selected verification width.
  if (!desktopOnly) await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('Choose a lesson').selectOption('printing')
  await page.waitForTimeout(500)
  await replaceCode(page, 'print("Hello, narrow layout!")\nprint("Ready")\n')
  await page.waitForTimeout(1500)
  await assertNoHorizontalOverflow(page, desktopOnly ? 'Completed beginner lesson on desktop' : 'Completed beginner lesson at 390px')
  await page.screenshot({
    path: path.join(outDir, desktopOnly ? 'desktop-recovered.png' : 'narrow-success.png'),
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
