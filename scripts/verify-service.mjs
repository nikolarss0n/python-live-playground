/** Real-worker regression for the connected service learning path. */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const argumentsList = process.argv.slice(2)
const desktopOnly = argumentsList.includes('--desktop-only')
const baseUrl = argumentsList.find((value) => !value.startsWith('--')) ?? 'http://127.0.0.1:5173'
const outDir = path.resolve('refs/verify')
const learnerNote = '# Learner note: validate input before calling a model.'

/** @param {import('playwright').Page} page @param {string} marker */
async function editorCode(page, marker) {
  const viewport = page.viewportSize()
  assert.ok(viewport, 'Expected a fixed test viewport')
  await page.setViewportSize({ width: viewport.width, height: 6000 })
  await page.waitForFunction((expected) => document.querySelector('.cm-content')?.textContent?.includes(expected), marker)
  await page.waitForFunction(() => !document.querySelector('.cm-content > .cm-gap'))
  const source = (await page.locator('.cm-content > .cm-line').allTextContents()).join('\n')
  await page.setViewportSize(viewport)
  return source
}

/** @param {import('playwright').Page} page @param {string} code */
async function replaceCode(page, code) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
  await page.keyboard.press('ControlOrMeta+Enter')
}

/** @param {import('playwright').Page} page @param {number} complete */
async function waitForProgress(page, complete) {
  await page.waitForFunction((expected) => {
    const progress = document.querySelector('[aria-label="Learning progress"]')?.textContent ?? ''
    const evidence = document.querySelector('.results-task-evidence')?.textContent ?? ''
    return progress.includes(`${expected}/3 exercises complete`) && evidence.startsWith('3/3 behavior checks passed.')
  }, complete, { timeout: 45_000 })
}

/** @param {import('playwright').Page} page @param {string} id */
async function selectedLesson(page, id) {
  await page.waitForFunction((expected) => {
    const select = document.querySelector('[aria-label="Choose a lesson"]')
    return select instanceof HTMLSelectElement && select.value === expected
  }, id)
}

/** @param {import('playwright').Page} page @param {string} label */
async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  assert.ok(dimensions.scroll <= dimensions.client + 1, `${label} has horizontal overflow: ${JSON.stringify(dimensions)}`)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.setDefaultTimeout(15_000)
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.locator('.cm-content').waitFor()
    await page.getByLabel('Choose learning track').selectOption('build')
    await page.getByLabel('Choose a lesson').selectOption('service-validation')
    await selectedLesson(page, 'service-validation')
    await page.waitForFunction(() => !/Loading Python/.test(document.querySelector('.status-label')?.textContent ?? ''), null, { timeout: 120_000 })
    assert.equal(await page.getByRole('button', { name: /^Next lesson:/ }).isEnabled(), false, 'Next must wait for verified code')

    const validationStarter = await editorCode(page, '# Step 1:')
    assert.ok(validationStarter.includes('question = ???'), 'Expected the visible validation starter')
    const validator = `${validationStarter
      .replace('question = ???', 'question = question.strip()')
      .replace('if ???:', 'if not question:')}\n${learnerNote}\n`
    await replaceCode(page, validator)
    await waitForProgress(page, 1)
    console.log('Validation function passed its behavior checks.')

    await page.getByRole('button', { name: /^Next lesson:/ }).click()
    await selectedLesson(page, 'service-endpoint')
    const endpointStarter = await editorCode(page, 'status_code=???')
    assert.ok(endpointStarter.includes(learnerNote), 'Step 2 must retain learner code')
    assert.ok(endpointStarter.includes('question = question.strip()'), 'Step 2 must reuse the completed validator')
    assert.ok(endpointStarter.includes('status_code=???'), `Expected endpoint starter, including its last block:\n${endpointStarter}`)
    const endpoint = endpointStarter
      .replace('question = ???', 'question = validate_question(payload)')
      .replace('status_code=???', 'status_code=422')
    await replaceCode(page, endpoint)
    await waitForProgress(page, 2)
    const statuses = await page.locator('.http-card-code').allTextContents()
    assert.ok(statuses.includes('200') && statuses.includes('422'), 'Valid and invalid requests must show 200 and 422')
    console.log('FastAPI endpoint reuses learner code and returns 200/422.')

    await page.getByRole('button', { name: /^Next lesson:/ }).click()
    await selectedLesson(page, 'service-tests')
    const testsStarter = await editorCode(page, 'Both request tests passed')
    assert.ok(testsStarter.includes(learnerNote), 'Step 3 must retain learner code')
    assert.ok(testsStarter.includes('question = validate_question(payload)'), 'Step 3 must reuse the completed endpoint')
    assert.ok(testsStarter.includes('Both request tests passed'), 'Expected the complete visible test scaffold')
    const goodTests = testsStarter
      .replace('assert response.status_code == ???', 'assert response.status_code == 200')
      .replace('assert response.json() == ???', 'assert response.json() == {"question": "What is Python?"}')
      .replace('    ???', '    response = client.post("/ask", json={"question": " "})\n    assert response.status_code == 422\n    assert response.json()["detail"]')
    await replaceCode(page, goodTests)
    await waitForProgress(page, 3)

    const noOpTests = `${endpoint}\ndef test_valid_request():\n    pass\ndef test_invalid_request():\n    pass\n`
    await replaceCode(page, noOpTests)
    await page.waitForFunction(() => {
      const evidence = document.querySelector('.results-task-evidence')?.textContent ?? ''
      const progress = document.querySelector('[aria-label="Learning progress"]')?.textContent ?? ''
      return evidence.startsWith('1/3 behavior checks passed.') && progress.includes('2/3 exercises complete')
    }, null, { timeout: 45_000 })
    console.log('No-op request tests correctly lose completion.')
    await replaceCode(page, goodTests)
    await waitForProgress(page, 3)
    const beforeReload = await editorCode(page, 'Both request tests passed')
    assert.equal(beforeReload, goodTests, 'Run shortcut must not change learner code')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await selectedLesson(page, 'service-tests')
    await waitForProgress(page, 3)
    const restoredCode = await editorCode(page, 'Both request tests passed')
    assert.equal(restoredCode, beforeReload, 'Reload must restore the exact learner source')
    assert.match(await page.getByRole('status', { name: 'Learning progress' }).innerText(), /saved on this device/)
    console.log('Reload preserves source, lesson position, and verified progress.')

    await assertNoHorizontalOverflow(page, 'Desktop 1440px')
    await page.screenshot({ path: path.join(outDir, 'service-desktop.png'), fullPage: true })
    if (!desktopOnly) {
      await page.setViewportSize({ width: 390, height: 844 })
      await assertNoHorizontalOverflow(page, 'Narrow 390px')
      await page.screenshot({ path: path.join(outDir, 'service-narrow.png'), fullPage: true })
    }
    console.log(desktopOnly ? 'Desktop checks passed; mobile deferred.' : 'Desktop and narrow layout checks passed; screenshots saved in refs/verify.')
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
