/** Desktop acceptance: local Apply fix rewrites the code, and the fixed program runs with the expected output. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const CASES = [
  ['missing import', 'print(math.sqrt(16))\n', ['4.0']],
  ['range one past the end', 'scores = [3, 7, 9]\nfor i in range(len(scores) + 1):\n    print(scores[i])\n', ['3', '7', '9']],
  ['infinite loop', 'n = 0\nwhile n < 3:\n    print(n)\n', ['0', '1', '2']],
  ['shadowed built-in (rename)', 'sum = 0\nprint(sum([1, 2]))\n', ['3']],
  ['used before defined (move)', 'print(total)\ntotal = 5\n', ['5']],
  ['divide by an empty length', 'items = []\naverage = sum(items) / len(items)\nprint(average)\n', ['0']],
  ['keyword typo', 'defz add(a, b):\n    return a + b\nprint(add(2, 3))\n', ['5']],
]

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.route('**/api/jev/**', (route) => route.fulfill({ json: { configured: false } }))
  await page.goto(baseUrl)
  const close = page.getByRole('button', { name: 'Close task', exact: true })
  if (await close.isVisible()) await close.click()
  for (const [name, source, expected] of CASES) {
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.insertText(source)
    await page.keyboard.press('ControlOrMeta+Enter')
    await page.locator('.cm-problem-line').hover({ position: { x: 12, y: 8 }, timeout: 30000 })
    await page.getByRole('button', { name: 'Apply fix' }).click({ timeout: 5000 })
    await page.keyboard.press('ControlOrMeta+Enter')
    await page.waitForFunction(() => !/Running|Loading/.test(document.querySelector('.results-status .status-label')?.textContent ?? ''), null, { timeout: 15000 })
    await page.waitForTimeout(500)
    assert.equal(await page.locator('.result-error-card').count(), 0, `${name}: the fixed code still fails`)
    const outputs = (await page.locator('.result-text').allInnerTexts()).map((text) => text.trim())
    assert.deepEqual(outputs, expected, `${name}: unexpected output`)
    console.log(`${name}: fixed and printed ${outputs.join(', ')}`)
  }
} finally {
  await browser.close()
}
