/** Desktop and narrow acceptance: after a clean run the Results pane lists each lesson task and the goal with green checks. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const shots = process.argv[3]
const STEPS = [
  ['first print unchanged', 'print("Hello, world!")\nprint(\'I am master\')\n', ['fail', 'pass', 'fail']],
  ['both tasks done', 'print("Hello, Nikolay!")\nprint("I am learning Python")\n', ['pass', 'pass', 'pass']],
]

const browser = await chromium.launch()
try {
  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport })
    await page.goto(`${baseUrl}/?lesson=printing`)
    for (const [name, source, expected] of STEPS) {
      await page.locator('.cm-content').click()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText(source)
      await page.keyboard.press('ControlOrMeta+Enter')
      const checks = page.getByRole('region', { name: 'Goal checks' })
      await checks.waitFor({ timeout: 30000 })
      await page.waitForFunction(() => !document.querySelector('.goal-check.is-checking'), null, { timeout: 25000 })
      // The previous run's checks stay on screen until this run settles, so wait for the expected states before asserting.
      await page.waitForFunction((want) => {
        const got = [...document.querySelectorAll('.goal-check')].map((item) => /is-(pass|fail)/.exec(item.className)?.[1])
        return got.join() === want.join()
      }, expected, { timeout: 25000 }).catch(() => {})
      const states = await checks.locator('.goal-check').evaluateAll((items) => items.map((item) => /is-(pass|fail)/.exec(item.className)?.[1]))
      assert.deepEqual(states, expected, `${label} ${name}: unexpected check states`)
      console.log(`${label} ${name}: ${(await checks.locator('.goal-checks-count').innerText()).trim()}`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      assert.equal(overflow, false, `${label}: horizontal page scroll`)
      if (shots) await checks.screenshot({ path: `${shots}/goal-checks-${label}-${expected.join('-')}.png` })
    }
    await page.close()
  }
} finally {
  await browser.close()
}
