/** Browser regression for the ten local GenAI exercises. No provider calls. */
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const argumentsList = process.argv.slice(2)
const desktopOnly = argumentsList.includes('--desktop-only')
const baseUrl = argumentsList.find((value) => !value.startsWith('--')) ?? 'http://127.0.0.1:5173'
const origin = new URL(baseUrl).origin
const outDir = path.resolve('refs/verify')

/** @typedef {{id: string, marker: string, replacements: string[]}} Fixture */
/** @param {unknown} value @returns {value is Fixture} */
function isFixture(value) {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'marker' in value && typeof value.marker === 'string' &&
    'replacements' in value && Array.isArray(value.replacements) &&
    value.replacements.every((replacement) => typeof replacement === 'string')
}

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
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
  await page.keyboard.press('ControlOrMeta+Enter')
}

/** @param {import('playwright').Page} page @param {number} complete */
async function waitForProgress(page, complete) {
  await page.waitForFunction((expected) => {
    const progress = document.querySelector('[aria-label="Learning progress"]')?.textContent ?? ''
    const evidence = document.querySelector('.results-task-evidence')?.textContent ?? ''
    return progress.includes(`${expected}/10 exercises complete`) && evidence.startsWith('3/3 behavior checks passed.')
  }, complete, { timeout: 45_000 })
}

/** @param {import('playwright').Page} page @param {string} id */
async function selectLesson(page, id) {
  await page.getByLabel('Choose a lesson').selectOption(id)
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
  assert.ok(dimensions.scroll <= dimensions.client + 1, `${label} overflows horizontally: ${JSON.stringify(dimensions)}`)
}

/** @param {URL} url */
function permittedAsset(url) {
  return url.origin === origin ||
    (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/pyodide/v0.27.7/full/')) ||
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
}

async function main() {
  const fixtures = JSON.parse(await readFile(new URL('./fixtures/genai-solutions.json', import.meta.url), 'utf8'))
  assert.ok(Array.isArray(fixtures) && fixtures.every(isFixture) && fixtures.length === 10, 'Expected ten validated lesson fixtures')
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const unexpectedRequests = []
  const pageErrors = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (permittedAsset(url)) return route.continue()
    unexpectedRequests.push(`${url.origin}${url.pathname}`)
    await route.abort()
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.setDefaultTimeout(20_000)
  try {
    await page.goto(new URL('/?lesson=genai-typed', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.locator('.cm-content').waitFor()
    await page.waitForFunction(() => !/Loading Python/.test(document.querySelector('.status-label')?.textContent ?? ''), null, { timeout: 120_000 })
    const solutions = new Map()
    for (const [index, fixture] of fixtures.entries()) {
      await selectLesson(page, fixture.id)
      const starter = await editorCode(page, fixture.marker)
      const solution = fixture.replacements.reduce((source, replacement) => source.replace('???', replacement), starter)
      assert.ok(!solution.includes('???'), `${fixture.id} has unmatched starter blanks`)
      await replaceCode(page, solution)
      await waitForProgress(page, index + 1)
      assert.equal(await editorCode(page, fixture.marker), solution, 'Ctrl+Enter must not insert or alter source text')
      solutions.set(fixture.id, solution)
      console.log(`${index + 1}/10 ${fixture.id}: all behavior checks passed.`)
    }

    await selectLesson(page, 'genai-async')
    const asyncSolution = solutions.get('genai-async')
    assert.equal(typeof asyncSolution, 'string')
    const uncooperativeTask = `${asyncSolution}\nasync def refuses_cancellation():\n    while True:\n        try:\n            await asyncio.sleep(60)\n        except asyncio.CancelledError:\n            pass\nbackground = asyncio.create_task(refuses_cancellation())\n`
    await replaceCode(page, uncooperativeTask)
    await page.waitForFunction(() =>
      /Timed out/.test(document.querySelector('.status-label')?.textContent ?? ''),
    null, { timeout: 15_000 })
    assert.match(await page.getByRole('status', { name: 'Learning progress' }).innerText(), /9\/10 exercises complete/)
    await replaceCode(page, asyncSolution)
    await waitForProgress(page, 10)
    console.log('A task that refuses cancellation triggers worker replacement; clean code recovers.')

    await selectLesson(page, 'genai-structured')
    const permissiveParser = 'import json\ndef parse_answer(raw_json):\n    return json.loads(raw_json)\n'
    await replaceCode(page, permissiveParser)
    await page.waitForFunction(() => {
      const evidence = document.querySelector('.results-task-evidence')?.textContent ?? ''
      const progress = document.querySelector('[aria-label="Learning progress"]')?.textContent ?? ''
      return evidence.startsWith('1/3 behavior checks passed.') && progress.includes('9/10 exercises complete')
    }, null, { timeout: 45_000 })
    const structured = solutions.get('genai-structured')
    assert.equal(typeof structured, 'string')
    await replaceCode(page, structured)
    await waitForProgress(page, 10)
    console.log('A permissive JSON parser loses completion; restoring strict validation recovers it.')

    await selectLesson(page, 'genai-audit')
    await waitForProgress(page, 10)
    const beforeReload = await editorCode(page, 'def audit_event(request_id, event)')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForProgress(page, 10)
    assert.equal(await page.getByLabel('Choose a lesson').inputValue(), 'genai-audit')
    assert.equal(await editorCode(page, 'def audit_event(request_id, event)'), beforeReload)
    console.log('Reload preserves the last lesson, exact source, and 10/10 verified exercises.')

    await page.getByRole('button', { name: 'Show lesson', exact: false }).click()
    const download = page.getByRole('link', { name: 'Download local AWS lab', exact: true })
    await download.waitFor()
    const href = await download.getAttribute('href')
    assert.ok(href, 'The local lab needs a download URL')
    const zipUrl = new URL(href, page.url())
    assert.equal(zipUrl.origin, origin, 'Lab download must be served by this app')
    const response = await page.request.get(zipUrl.href)
    assert.equal(response.status(), 200, 'The ZIP download must exist')
    assert.match(response.headers()['content-type'] ?? '', /zip|octet-stream/)
    const archive = await response.body()
    assert.equal(archive.subarray(0, 2).toString('ascii'), 'PK', 'Download must be a ZIP archive')
    assert.ok(archive.length > 1000, 'The lab ZIP must contain its source files')
    console.log('The visible local-lab link serves a ZIP archive.')
    await page.getByRole('button', { name: 'Hide lesson', exact: false }).click()

    assert.deepEqual(unexpectedRequests, [], 'Browser exercises must not attempt provider or other unexpected external calls')
    assert.deepEqual(pageErrors, [], 'No unhandled browser application errors are expected')
    await assertNoHorizontalOverflow(page, 'Desktop 1440px')
    await page.locator('.cm-content').press('ControlOrMeta+End')
    await page.screenshot({ path: path.join(outDir, 'genai-desktop.png'), fullPage: true })
    if (!desktopOnly) {
      await page.setViewportSize({ width: 390, height: 844 })
      await assertNoHorizontalOverflow(page, 'Narrow 390px')
      await page.screenshot({ path: path.join(outDir, 'genai-narrow.png'), fullPage: true })
    }
    console.log(desktopOnly ? 'No provider calls; desktop checks passed; mobile deferred.' : 'No provider calls; desktop/narrow checks passed and screenshots saved.')
  } catch (error) {
    console.error('Last visible state:', await page.locator('.status-label, .results-task-evidence, [aria-label="Learning progress"]').allTextContents())
    await page.screenshot({ path: path.join(outDir, 'genai-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
