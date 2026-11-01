/** Real Pyodide/UI regression for the complete 14-day Python refresher. */
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const origin = new URL(baseUrl).origin
const outDir = path.resolve('refs/verify')
const durationMs = 60 * 60_000

/** @typedef {import('playwright').Page} Page */
/** @typedef {{id:string,replacements:string[],independentSolution:string,guidedSolution?:string}} Foundation */
/** @typedef {{initial:string,followUp?:string}} MockSolution */
/** @typedef {{practice:Record<string,string>,mocks:Record<string,Record<string,MockSolution>>}} Advanced */
/** @param {unknown} value @returns {value is Record<string,unknown>} */
function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }
/** @param {unknown} value @returns {value is Foundation} */
function foundation(value) {
  return record(value) && typeof value.id === 'string' && typeof value.independentSolution === 'string' &&
    Array.isArray(value.replacements) && value.replacements.every((part) => typeof part === 'string') &&
    (value.guidedSolution === undefined || typeof value.guidedSolution === 'string')
}
/** @param {unknown} value @returns {value is Advanced} */
function advanced(value) {
  return record(value) && record(value.practice) && Object.values(value.practice).every((source) => typeof source === 'string') &&
    record(value.mocks) && Object.values(value.mocks).every((variants) => record(variants) &&
      ['a', 'b', 'c'].every((variant) => record(variants[variant]) && typeof variants[variant].initial === 'string' &&
        (variants[variant].followUp === undefined || typeof variants[variant].followUp === 'string')))
}
/** @param {string} filename */
async function fixture(filename) {
  /** @type {unknown} */
  const value = JSON.parse(await readFile(new URL(`./fixtures/${filename}`, import.meta.url), 'utf8'))
  return value
}
/** @param {Page} page */
const panel = (page) => page.getByRole('region', { name: 'Daily practice', exact: true })
/** @param {Page} page */
async function openSession(page) {
  const toggle = panel(page).getByRole('button', { name: 'Task', exact: true })
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
}
/** @param {Page} page @param {string} name */
async function selectStage(page, name) {
  await panel(page).getByRole('navigation', { name: 'Session stages' }).getByRole('button', { name: new RegExp(`^${name}(, complete)?$`) }).click()
  await page.waitForFunction((stage) => document.querySelector('.refresher-stages [aria-current="step"]')?.textContent?.startsWith(stage), name)
  await openSession(page)
}
/** @param {Page} page @param {string} id */
async function selectDay(page, id) {
  await page.getByLabel('Choose a lesson', { exact: true }).selectOption(id)
  await page.waitForFunction((expected) => document.querySelector('[aria-label="Choose a lesson"]')?.value === expected, id)
  await openSession(page)
}
/** @param {Page} page */
async function editorCode(page) {
  const viewport = page.viewportSize()
  assert.ok(viewport)
  await page.setViewportSize({ width: viewport.width, height: 6500 })
  await page.waitForFunction(() => document.querySelector('.cm-content') && !document.querySelector('.cm-content > .cm-gap'))
  // CodeMirror defers external value changes while its typing latch is active.
  // Read-only storage observation confirms the visible editor catches up to the saved draft.
  await page.waitForFunction(() => {
    const id = document.querySelector('[aria-label="Choose a lesson"]')?.value
    const saved = JSON.parse(localStorage.getItem('plp-refresher-v1') ?? '{}').days?.[id]
    const workspace = saved?.workspaces?.[saved.workspaceKey]
    const expected = workspace?.[saved.stage === 'review' ? 'independent' : saved.stage]?.code
    const visible = [...document.querySelectorAll('.cm-content > .cm-line')].map((line) => line.textContent).join('\n')
    return typeof expected === 'string' && visible === expected
  })
  const code = (await page.locator('.cm-content > .cm-line').allTextContents()).join('\n')
  await page.setViewportSize(viewport)
  return code
}
/** @param {Page} page @param {string} code */
async function replaceCode(page, code) {
  const close = page.getByRole('button', { name: 'Close task', exact: true })
  if (await close.isVisible()) await close.click()
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
  await page.keyboard.press('ControlOrMeta+Enter')
  await openSession(page)
}
/** @param {Page} page */
async function waitForChecks(page) {
  await page.waitForFunction(() => {
    const states = [...document.querySelectorAll('.refresher-check-state')].map((node) => node.textContent)
    const evidence = document.querySelector('.results-task-evidence')?.textContent ?? ''
    return states.length > 0 && states.every((state) => state === 'Passed') &&
      evidence.startsWith(`${states.length}/${states.length} behavior checks passed.`)
  }, null, { timeout: 45_000 })
}
/** @param {Page} page @param {number} expected */
async function waitForDays(page, expected) {
  await page.waitForFunction((count) => document.querySelector('[aria-label="Learning progress"]')?.textContent?.includes(`${count}/14 days complete`), expected)
}
/** @param {Page} page */
async function assertNoAi(page) {
  assert.equal(await page.getByLabel('Ask about this lesson', { exact: true }).count(), 0, 'AI coach must be absent')
  assert.equal(await page.getByRole('region', { name: 'Run with model', exact: true }).count(), 0, 'Model runner must be absent')
}
/** @param {Page} page @param {string} label @param {string} note */
async function writeNote(page, label, note) {
  await panel(page).getByLabel(label, { exact: true }).fill(note)
  await panel(page).getByLabel(label, { exact: true }).press('Tab')
}
/** @param {Page} page */
async function continueStage(page) {
  await panel(page).getByRole('button', { name: 'Continue', exact: true }).click()
}
/** @param {Page} page @param {number} dayNumber */
async function preparePractice(page, dayNumber) {
  await selectStage(page, 'Recall')
  await writeNote(page, 'Recall note', `Day ${dayNumber}: I recalled the input, output, and an empty-input case.`)
  await continueStage(page)
  await panel(page).getByLabel('I can explain the examples in my own words', { exact: true }).check()
  await writeNote(page, 'Working note', 'I explained the values and control flow before editing.')
  await continueStage(page)
}
/** @param {Page} page @param {number} expectedDays @param {boolean} mock */
async function finishReview(page, expectedDays, mock = false) {
  if (mock) {
    for (const label of ['Readability:', 'Edge cases:', 'Debugging:', 'Communication:']) {
      await panel(page).getByRole('checkbox', { name: new RegExp(`^${label}`) }).check()
    }
    await writeNote(page, 'Evidence for this review', 'I checked one malformed input and explained the trade-off.')
  }
  await writeNote(page, 'Reflection', 'I tested the boundary case and can explain the correction.')
  await panel(page).getByLabel('I reviewed my mistakes and recorded a correction', { exact: true }).check()
  await panel(page).getByRole('button', { name: 'Mark review complete', exact: true }).click()
  await waitForDays(page, expectedDays)
}
/** @param {Page} page */
async function openMistakes(page) {
  const summary = panel(page).locator('summary').filter({ hasText: /^Mistake log/ })
  if (!await summary.evaluate((node) => node.parentElement?.hasAttribute('open'))) await summary.click()
}
/** @param {Page} page @param {string} error */
async function addMistake(page, error) {
  await openMistakes(page)
  await panel(page).getByLabel('Error', { exact: true }).fill(error)
  await panel(page).getByLabel('Cause', { exact: true }).fill('I skipped an input boundary.')
  await panel(page).getByLabel('Correct pattern', { exact: true }).fill('Validate the input before changing the result.')
  await panel(page).getByRole('button', { name: 'Save mistake', exact: true }).click()
  await panel(page).getByRole('button', { name: `Edit mistake: ${error}`, exact: true }).waitFor()
}
/** @param {Page} page */
async function savedState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('plp-refresher-v1') ?? '{}'))
}
/** @param {Page} page @param {string} id */
async function mockVariant(page, id) {
  const state = await savedState(page)
  const day = state.days?.[id]
  const attempt = day?.attempts?.find((entry) => entry.workspaceKey === day.workspaceKey)
  assert.ok(attempt && ['a', 'b', 'c'].includes(attempt.variantId), 'Expected a persisted mock variant selected by the UI')
  return attempt.variantId
}
/** @param {Page} page */
async function assertFrozen(page) {
  const before = await editorCode(page)
  const close = page.getByRole('button', { name: 'Close task', exact: true })
  if (await close.isVisible()) await close.click()
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.insertText('\n# This must not enter a frozen submission')
  assert.equal(await editorCode(page), before, 'Submitted source must remain frozen')
  await openSession(page)
}
/** @param {Page} page @param {number} expectedDays */
async function reviewMock(page, expectedDays) {
  await waitForChecks(page)
  await assertFrozen(page)
  await panel(page).getByRole('button', { name: 'Review attempt', exact: true }).click()
  await finishReview(page, expectedDays, true)
}
/** @param {Page} page */
async function startAnotherMock(page) {
  await panel(page).getByRole('button', { name: /^Start another (attempt|retake)$/ }).click()
  await page.getByLabel('Mock time remaining', { exact: true }).waitFor()
}
/** @param {Page} page @param {string} label */
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  assert.ok(dimensions.scroll <= dimensions.width + 1, `${label} overflows horizontally: ${JSON.stringify(dimensions)}`)
}
/** @param {Page} page @param {number} milliseconds */
async function advanceClock(page, milliseconds) {
  const before = await page.evaluate(() => Date.now())
  // Playwright 1.51 can race its real-time ticker against fastForward and roll Date.now back.
  // Pause first (slightly in the future to allow the command round trip), then advance serially.
  await page.clock.pauseAt(new Date(before + 1000))
  try {
    await page.clock.fastForward(milliseconds)
    assert.ok(await page.evaluate(() => Date.now()) >= before + milliseconds,
      'The test clock must retain its full advance before the app is exercised')
  } finally {
    await page.clock.resume()
  }
  assert.ok(await page.evaluate(() => Date.now()) >= before + milliseconds,
    'Resuming the test clock must not roll wall time back')
}
/** @param {URL} url */
function permittedAsset(url) {
  return url.origin === origin ||
    (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/pyodide/v0.27.7/full/')) ||
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
}

async function main() {
  const foundations = await fixture('refresher-foundations.json')
  const advancedFixtures = await fixture('refresher-advanced.json')
  const consolidation = await fixture('refresher-consolidation.json')
  assert.ok(Array.isArray(foundations) && foundations.every(foundation) && foundations.length === 7)
  assert.ok(advanced(advancedFixtures))
  assert.ok(record(consolidation) && Object.values(consolidation).every((source) => typeof source === 'string'))
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => { Math.random = () => 0.1 })
  const unexpectedRequests = []
  const pageErrors = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (permittedAsset(url)) return route.continue()
    unexpectedRequests.push(`${url.origin}${url.pathname}`)
    return route.abort()
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.setDefaultTimeout(20_000)
  await page.clock.install({ time: new Date('2026-10-29T10:00:00Z') })
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('.cm-content').waitFor()
    assert.equal(await page.getByLabel('Choose learning track', { exact: true }).inputValue(), 'interview', 'A new learner should start in the refresher')
    await page.waitForFunction(() => !document.querySelector('.status-label')?.textContent?.includes('Loading Python'), null, { timeout: 120_000 })
    await assertNoAi(page)

    for (let number = 1; number <= 11; number++) {
      const id = `refresher-${String(number).padStart(2, '0')}`
      await selectDay(page, id)
      await preparePractice(page, number)
      const starter = await editorCode(page)
      const entry = foundations.find((item) => item.id === id)
      const guided = entry ? entry.guidedSolution ?? entry.replacements.reduce((source, replacement) => source.replace('???', replacement), starter)
        : advancedFixtures.practice[id]
      assert.equal(typeof guided, 'string', `Missing guided source for ${id}`)
      assert.ok(!guided.includes('???'), `${id} has unmatched guided blanks`)
      if (number === 1) {
        await page.waitForFunction(() => document.querySelector('.results-body')?.textContent?.includes('Replace ???'), null, { timeout: 45_000 })
      }
      await replaceCode(page, guided)
      await waitForChecks(page)

      if (number === 1) {
        const original = await editorCode(page)
        await panel(page).getByRole('button', { name: 'Restart current stage', exact: true }).click()
        await page.reload({ waitUntil: 'domcontentloaded' })
        await openSession(page)
        await panel(page).getByRole('button', { name: 'Restore previous draft', exact: true }).click()
        await waitForChecks(page)
        assert.equal(await editorCode(page), original, 'Restore after reload must recover the exact verified draft')
        await panel(page).getByRole('button', { name: 'Restart current stage', exact: true }).click()
        const editedRestart = `${guided}\n# New work after restart\n`
        await replaceCode(page, editedRestart)
        await panel(page).getByRole('button', { name: 'Restore previous draft', exact: true }).click()
        assert.equal(await editorCode(page), original)
        await panel(page).getByRole('button', { name: 'Restore previous draft', exact: true }).click()
        assert.equal(await editorCode(page), editedRestart, 'Restoring must preserve newer edits in a recoverable backup')
        await waitForChecks(page)
      }
      await continueStage(page)
      const independentStarter = await editorCode(page)
      assert.notEqual(independentStarter, guided, `${id} must have a separate independent draft`)
      assert.equal(await panel(page).locator('summary').filter({ hasText: /Walkthrough guidance|Show a hint|Show one hint/ }).count(), 0)
      const independent = entry?.independentSolution ?? advancedFixtures.practice[id]
      assert.equal(typeof independent, 'string')
      await replaceCode(page, independent)
      await waitForChecks(page)
      await continueStage(page)
      await finishReview(page, number)
      if (number === 1) {
        await addMistake(page, 'Boolean values need exact handling')
        await panel(page).getByRole('button', { name: 'Edit mistake: Boolean values need exact handling', exact: true }).click()
        await panel(page).getByLabel('Cause', { exact: true }).fill('I confused false with missing input.')
        await panel(page).getByRole('button', { name: 'Save mistake changes', exact: true }).click()
        await panel(page).getByRole('button', { name: 'Mark resolved', exact: true }).click()
      }
      if (number === 5) await addMistake(page, 'Copy before normalizing caller data')
      if (number === 7) await addMistake(page, 'Validate fields before assertions')
      await assertNoAi(page)
      console.log(`${number}/14 ${id}: real guided + independent checks, recall, explanation, and review passed.`)
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    await openSession(page)
    await waitForDays(page, 11)
    const saved = await savedState(page)
    assert.equal(saved.mistakes.length, 3)
    assert.equal(saved.mistakes[0].cause, 'I confused false with missing input.')
    assert.equal(saved.mistakes[0].resolved, true)
    assert.ok(saved.days['refresher-01'].workspaces.practice.recall.note.includes('Day 1'))

    await selectDay(page, 'refresher-12')
    assert.equal(await page.getByLabel('Mock time remaining', { exact: true }).count(), 0)
    assert.match(await editorCode(page), /Start the mock/)
    await panel(page).getByRole('button', { name: 'Start 60-minute mock', exact: true }).click()
    for (const expectedVariant of ['a', 'b', 'c']) {
      const variant = await mockVariant(page, 'refresher-12')
      assert.equal(variant, expectedVariant)
      assert.match(await panel(page).innerText(), /Unseen on first start/)
      await replaceCode(page, advancedFixtures.mocks['refresher-12'][variant].initial)
      assert.equal(await panel(page).getByLabel('Exercise checks', { exact: true }).count(), 0, 'Active mock checks stay hidden')
      if (variant === 'a') {
        await writeNote(page, 'Interview working notes', 'I clarified inputs and wrote a plan before implementing.')
        await page.getByLabel('Choose learning track', { exact: true }).selectOption('ml')
        const showLesson = page.getByRole('button', { name: /^Show lesson/ })
        if (await showLesson.isVisible()) await showLesson.click()
        await assertNoAi(page)
        await page.getByLabel('Choose learning track', { exact: true }).selectOption('interview')
        await selectDay(page, 'refresher-13')
        assert.equal(await panel(page).getByRole('button', { name: 'Start 60-minute mock', exact: true }).isEnabled(), false, 'A second mock must not start while another is active')
        await selectDay(page, 'refresher-12')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await openSession(page)
        assert.equal(await panel(page).getByLabel('Interview working notes', { exact: true }).inputValue(), 'I clarified inputs and wrote a plan before implementing.')
        await advanceClock(page, durationMs + 1000)
        await page.getByLabel('Mock time used', { exact: true }).waitFor()
        assert.equal(await page.getByLabel('Mock time used', { exact: true }).innerText(), '60:00')
      } else {
        await panel(page).getByRole('button', { name: 'Submit attempt', exact: true }).click()
      }
      await reviewMock(page, 12)
      if (variant !== 'c') await startAnotherMock(page)
      console.log(`Mock12 ${variant}: submitted checks and rubric passed${variant === 'a' ? '; timer expired across navigation/reload' : ''}.`)
    }

    await selectDay(page, 'refresher-13')
    await panel(page).getByRole('button', { name: 'Start 60-minute mock', exact: true }).click()
    assert.equal(await mockVariant(page, 'refresher-13'), 'a')
    await replaceCode(page, advancedFixtures.mocks['refresher-13'].a.initial)
    await panel(page).getByRole('button', { name: 'Submit attempt', exact: true }).click()
    await waitForChecks(page)
    assert.match(await panel(page).innerText(), /Partial attempt: submitted before/)
    await reviewMock(page, 12)
    console.log('Mock13 early submission remains partial even with passing checks and reviewed rubric.')
    for (const expectedVariant of ['b', 'c', 'a']) {
      await startAnotherMock(page)
      const variant = await mockVariant(page, 'refresher-13')
      assert.equal(variant, expectedVariant)
      assert.match(await panel(page).innerText(), variant === 'a' ? /Seen variant: practice retake/ : /Unseen on first start/)
      const solution = advancedFixtures.mocks['refresher-13'][variant]
      await replaceCode(page, solution.initial)
      assert.equal(await panel(page).getByRole('region', { name: 'Requirement change' }).count(), 0)
      await advanceClock(page, 30 * 60_000)
      await panel(page).getByRole('region', { name: 'Requirement change' }).waitFor()
      assert.equal(typeof solution.followUp, 'string')
      await replaceCode(page, solution.followUp)
      await assertNoAi(page)
      await panel(page).getByRole('button', { name: 'Submit attempt', exact: true }).click()
      const submittedDay = (await savedState(page)).days['refresher-13']
      const submittedAttempt = submittedDay.attempts.find((attempt) => attempt.workspaceKey === submittedDay.workspaceKey)
      assert.ok(submittedAttempt && typeof submittedAttempt.finishedAt === 'number' &&
        submittedAttempt.finishedAt - submittedAttempt.startedAt >= 30 * 60_000,
      'The saved submission must retain at least 30 minutes of elapsed time')
      await reviewMock(page, 13)
      console.log(`Mock13 ${variant}: minute-30 requirement change and frozen submission passed.`)
    }

    await selectDay(page, 'refresher-14')
    assert.equal(await panel(page).getByLabel('Function 1', { exact: true }).inputValue(), 'refresher-05')
    assert.equal(await panel(page).getByLabel('Function 2', { exact: true }).inputValue(), 'refresher-07')
    await preparePractice(page, 14)
    assert.equal(await panel(page).getByRole('button', { name: 'Run checks', exact: true }).count(), 0, 'Day14 Guided is planning, not a second implementation')
    await writeNote(page, 'Working note', 'Plan normalize_record and validate_record: copy inputs; reject malformed fields; test empty records.')
    await continueStage(page)
    const selectedSource = `${consolidation['refresher-05']}\n\n${consolidation['refresher-07']}`
    await replaceCode(page, selectedSource)
    await waitForChecks(page)
    const pairDetails = panel(page).locator('details').filter({ has: page.locator('summary', { hasText: 'Two functions to revisit' }) })
    if (!await pairDetails.evaluate((node) => node.hasAttribute('open'))) await pairDetails.locator('summary').click()
    await panel(page).getByLabel('Function 2', { exact: true }).selectOption('refresher-05')
    assert.equal(await panel(page).getByRole('button', { name: 'Use these two exercises', exact: true }).isEnabled(), false)
    await panel(page).getByLabel('Function 1', { exact: true }).selectOption('refresher-03')
    await panel(page).getByLabel('Function 2', { exact: true }).selectOption('refresher-04')
    await panel(page).getByRole('button', { name: 'Use these two exercises', exact: true }).click()
    await replaceCode(page, '# Separate draft for the second selected pair\n')
    await panel(page).getByLabel('Function 1', { exact: true }).selectOption('refresher-05')
    await panel(page).getByLabel('Function 2', { exact: true }).selectOption('refresher-07')
    await panel(page).getByRole('button', { name: 'Use these two exercises', exact: true }).click()
    assert.equal(await editorCode(page), selectedSource, 'Changing day14 selection must preserve each pair’s independent draft')
    await waitForChecks(page)
    await continueStage(page)
    await finishReview(page, 14)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openSession(page)
    await waitForDays(page, 14)
    await waitForChecks(page)
    assert.equal(await editorCode(page), selectedSource, 'Review after reload must show the completed independent source')
    assert.equal(await panel(page).getByLabel('Reflection', { exact: true }).inputValue(), 'I tested the boundary case and can explain the correction.')
    console.log('Day14 personalized pair, planning, distinct drafts, review and14/14 reload passed.')

    const download = panel(page).getByRole('link', { name: 'Download local Python practice', exact: true })
    const href = await download.getAttribute('href')
    assert.ok(href)
    const url = new URL(href, page.url())
    assert.equal(url.origin, origin)
    const response = await page.request.get(url.href)
    assert.equal(response.status(), 200)
    const archive = await response.body()
    assert.equal(archive.subarray(0, 2).toString('ascii'), 'PK')
    assert.ok(archive.length > 1000)
    await assertNoAi(page)
    await noOverflow(page, 'Desktop 1440px')
    await page.screenshot({ path: path.join(outDir, 'refresher-desktop.png'), fullPage: true })
    assert.deepEqual(unexpectedRequests, [], 'No provider or unexpected external requests may be attempted')
    assert.deepEqual(pageErrors, [], 'No unhandled browser errors are expected')
    console.log('All 14 days, six mock variants, source ZIP and desktop checks passed; no provider calls.')
  } catch (error) {
    console.error('Last visible state:', await page.locator('.status-label, .results-task-evidence, .refresher-summary, [aria-label="Learning progress"]').allTextContents())
    console.error('Visible notices:', await page.locator('.refresher-notice, .error-card').allTextContents())
    await page.screenshot({ path: path.join(outDir, 'refresher-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { await browser.close() }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
