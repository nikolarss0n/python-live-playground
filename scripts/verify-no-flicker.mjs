/** Browser acceptance: editing one line re-renders only that result; other rows, goal checks and status stay put. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const START = 'print("Hello, Ada!")\nprint("I am learning Python")\nprint("third line")\n'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${baseUrl}/?lesson=printing`)
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(START)
  await page.keyboard.press('ControlOrMeta+Enter')
  await page.getByRole('region', { name: 'Goal checks' }).waitFor({ timeout: 30000 })
  await page.waitForFunction(() => document.querySelectorAll('.result-text').length === 3, null, { timeout: 15000 })
  await page.waitForTimeout(1500)

  await page.evaluate(() => {
    const log = { removedRows: [], blankFrames: 0, checksGone: 0, runningShown: 0, pulsed: new Set() }
    window.__flicker = log
    const body = document.querySelector('.results-panel')
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.removedNodes) {
        if (node instanceof HTMLElement && node.matches('.result-row:not(.is-ghost)')) log.removedRows.push(node.innerText.trim())
      }
    }).observe(body, { childList: true, subtree: true })
    const sample = () => {
      if (document.querySelectorAll('.results-panel .result-row:not(.is-ghost)').length === 0) log.blankFrames += 1
      if (!document.querySelector('.goal-checks')) log.checksGone += 1
      const running = document.querySelector('.status-label-running')
      if (running && getComputedStyle(running).opacity !== '0') log.runningShown += 1
      for (const line of document.querySelectorAll('.cm-run-pulse-line')) log.pulsed.add(line.textContent)
      if (!log.stop) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })

  // Edit only the third line, like typing.
  await page.locator('.cm-line', { hasText: 'third line' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.type('!!', { delay: 80 })
  await page.waitForFunction(() => [...document.querySelectorAll('.result-text')].some((el) => el.textContent.includes('third line!!')), null, { timeout: 15000 })
  await page.waitForTimeout(1200)

  const log = await page.evaluate(() => { window.__flicker.stop = true; return { ...window.__flicker, pulsed: [...window.__flicker.pulsed] } })
  console.log(JSON.stringify(log))
  assert.equal(log.blankFrames, 0, 'results blanked during the re-run')
  assert.equal(log.checksGone, 0, 'goal checks disappeared during the re-run')
  assert.equal(log.runningShown, 0, '"Running…" blinked for a fast run')
  assert.ok(log.removedRows.every((text) => text.includes('third line')), `unchanged rows were remounted: ${log.removedRows}`)
  assert.ok(log.pulsed.every((text) => text.includes('third line')), `unchanged lines pulsed: ${log.pulsed}`)
  console.log('only the edited line changed')
} finally {
  await browser.close()
}
