/** Desktop-only acceptance for deterministic errors and explicitly requested AI hints. */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const origin = new URL(baseUrl).origin
const endpoint = `${origin}/test-ai/chat/completions`
const fixtureKey = 'fixture-error-help-key-DO-NOT-USE'
const fixtureSecret = 'fixture-password-never-send'
const fixtureAnswer = 'Synthetic fixture: Python defines a function with def.'
const staleAnswer = 'Stale synthetic fixture that must never appear.'
const outDir = path.resolve('refs/verify')
const screenshotSource = 'a=5\nb=7\nfunction sumy(a,b):\n    print(a+b)\n\nsumy(a,b)\n'

/** @typedef {import('playwright').Page} Page */
/** @param {unknown} value @returns {value is Record<string,unknown>} */
function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }

function signal() {
  /** @type {(() => void) | undefined} */
  let resolve
  const promise = new Promise((done) => { resolve = () => done(undefined) })
  return { promise, release() { resolve?.() } }
}

/** @param {Page} page @param {string} code */
async function replaceCode(page, code) {
  const close = page.getByRole('button', { name: 'Close task', exact: true })
  if (await close.isVisible()) await close.click()
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
  await page.keyboard.press('ControlOrMeta+Enter')
}

/** @param {Page} page @param {string} expected */
async function assertSource(page, expected) {
  const viewport = page.viewportSize()
  assert.ok(viewport)
  await page.setViewportSize({ width: viewport.width, height: 6000 })
  await page.waitForFunction((code) => {
    const lines = [...document.querySelectorAll('.cm-content > .cm-line')].map((line) => line.textContent).join('\n')
    return !document.querySelector('.cm-content > .cm-gap') && lines === code
  }, expected)
  assert.equal((await page.locator('.cm-content > .cm-line').allTextContents()).join('\n'), expected)
  await page.setViewportSize(viewport)
}

/** @param {Page} page @param {string} name */
async function waitForFunctionError(page, name = 'sumy') {
  await page.waitForFunction((functionName) => {
    const type = document.querySelector('.error-card-type')?.textContent ?? ''
    const tip = document.querySelector('.error-card-tip-text')?.textContent ?? ''
    return type === 'SyntaxError' && tip.includes('Replace `function` with `def`') && tip.includes(`${functionName}(...)`)
  }, name, { timeout: 45_000 })
}

/** @param {Page} page */
async function openAiHelp(page) {
  const button = page.getByRole('button', { name: 'AI error help', exact: true })
  if (await button.isVisible()) await button.click()
}

/** @param {Page} page */
async function assertAiBlocked(page) {
  assert.equal(await page.getByRole('button', { name: 'AI error help', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Ask for a hint', exact: true }).count(), 0)
  assert.equal(await page.getByRole('textbox', { name: 'Ask about this lesson', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Open settings', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Test model', exact: true }).isEnabled(), false)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
}

/** @param {Page} page */
async function showSession(page) {
  const show = page.getByRole('button', { name: 'Task', exact: true })
  if (await show.getAttribute('aria-expanded') === 'false') await show.click()
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  /** @type {{method:string,body:string|null}[]} */
  const requests = []
  /** @type {string[]} */
  const unexpected = []
  /** @type {string[]} */
  const requestFailures = []
  /** @type {string[]} */
  const fixtureFailures = []
  const delayedRequest = signal()
  const delayedReply = signal()
  let delayNextReply = false
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.href === endpoint) {
      requests.push({ method: request.method(), body: request.postData() })
      const delayed = delayNextReply
      if (delayed) { delayedRequest.release(); await delayedReply.promise }
      const advice = {
        explanation: delayed ? staleAnswer : fixtureAnswer,
        hint: 'Replace only the function keyword, keep the arguments, and indent the existing body.',
        example: 'def sumy(a,b):\n    print(a+b)',
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify(advice) }, finish_reason: 'stop' }],
      }) }).catch((error) => { if (!delayed) fixtureFailures.push(String(error)) })
      return
    }
    // Keep this script offline and deterministic: the dev server's Jev bridge reports itself unconfigured.
    if (url.origin === origin && url.pathname.startsWith('/api/jev/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: false }) })
    }
    const permitted = url.origin === origin && !url.pathname.startsWith('/test-ai') ||
      url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/pyodide/v0.27.7/full/') ||
      ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)
    if (permitted) return route.continue()
    unexpected.push(`${url.origin}${url.pathname}`)
    await route.abort()
  })
  const page = await context.newPage()
  page.on('requestfailed', (request) => {
    if (request.url() === endpoint) requestFailures.push(request.failure()?.errorText ?? 'unknown failure')
  })
  page.setDefaultTimeout(20_000)
  try {
    await page.goto(`${baseUrl.replace(/\/$/, '')}/?lesson=printing`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.locator('.cm-content').waitFor()
    await page.waitForFunction(() => !/Loading Python/.test(document.querySelector('.status-label')?.textContent ?? ''), null, { timeout: 120_000 })
    await replaceCode(page, screenshotSource)
    await waitForFunctionError(page)
    assert.match(await page.locator('.error-card-raw').innerText(), /invalid syntax/)
    await page.getByRole('button', { name: 'What does this mean?', exact: true }).click()
    await page.getByRole('button', { name: 'Show a fixed example', exact: true }).click()
    assert.equal(await page.locator('.error-card-example-wrap pre').innerText(), 'def sumy(a,b):\n    print(a+b)')
    await page.getByRole('button', { name: 'Traceback', exact: true }).click()
    const traceback = await page.locator('.result-traceback').innerText()
    assert.ok(traceback.includes('SyntaxError') && traceback.includes('function sumy(a,b):'), 'Raw traceback must retain the original failing source')
    await page.getByRole('button', { name: 'Hide traceback', exact: true }).click()
    await assertSource(page, screenshotSource)
    await page.locator('header.toolbar').scrollIntoViewIfNeeded()
    await page.mouse.move(10, 10)
    await page.screenshot({ path: path.join(outDir, 'error-help-desktop.png'), fullPage: true })
    assert.equal(requests.length, 0, 'Local diagnosis must not call a model')
    console.log('Precise local function diagnosis, actual fixed example, and raw traceback work without a key.')

    await openAiHelp(page)
    await page.getByText('Snippet and error to send', { exact: true }).click()
    assert.equal(requests.length, 0, 'Opening the preview must not call a model')
    await page.getByRole('button', { name: 'Configure AI help', exact: true }).click()
    assert.equal(await page.getByLabel('API key', { exact: true }).inputValue(), '', 'The isolated test context must start without a real key')
    await page.getByLabel('API key', { exact: true }).fill(fixtureKey)
    await page.getByLabel('LLM base URL', { exact: true }).fill(`${origin}/test-ai`)
    await page.getByLabel('LLM model', { exact: true }).fill('fixture-python-tutor')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    assert.equal(requests.length, 0, 'Saving provider settings must not send a request')

    const privateFixtureSource = `a=5\npassword = "${fixtureSecret}" # ${'x'.repeat(260)}\napi_key = "${fixtureKey}"\nb=7\nfunction sumy(a,b):\n    print(a+b)\nsumy(a,b)\n${'# unrelated context\n'.repeat(8)}# FAR_AWAY_SOURCE_MUST_NOT_BE_SHARED\n`
    await replaceCode(page, privateFixtureSource)
    await waitForFunctionError(page)
    await openAiHelp(page)
    await page.getByText('Snippet and error to send', { exact: true }).click()
    const preview = await page.locator('.error-ai-content details').innerText()
    assert.ok(preview.includes('[REDACTED]'))
    assert.ok(!preview.includes(fixtureKey) && !preview.includes(fixtureSecret))
    assert.equal(requests.length, 0, 'Configured AI remains idle until the explicit hint button')
    await page.getByRole('button', { name: 'Ask for a hint', exact: true }).click()
    await page.getByRole('status', { name: 'AI error suggestion', exact: true }).waitFor()
    assert.equal(requests.length, 1)
    const request = requests[0]
    assert.equal(request.method, 'POST')
    assert.ok(request.body && request.body.length <= 8000)
    assert.ok(!request.body.includes(fixtureKey) && !request.body.includes(fixtureSecret))
    assert.ok(!request.body.includes('FAR_AWAY_SOURCE_MUST_NOT_BE_SHARED'))
    /** @type {unknown} */
    const payload = JSON.parse(request.body)
    assert.ok(record(payload) && payload.model === 'fixture-python-tutor' && typeof payload.max_tokens === 'number' && payload.max_tokens <= 240)
    assert.ok(Array.isArray(payload.messages) && payload.messages.length === 2)
    const userMessage = payload.messages[1]
    assert.ok(record(userMessage) && userMessage.role === 'user' && typeof userMessage.content === 'string')
    /** @type {unknown} */
    const shared = JSON.parse(userMessage.content)
    assert.ok(record(shared) && typeof shared.snippet === 'string' && shared.snippet.split('\n').length <= 7)
    assert.equal(shared.redacted, true)
    assert.equal(shared.truncated, true)
    assert.ok(!('apiKey' in shared))
    assert.match(await page.getByRole('status', { name: 'AI error suggestion', exact: true }).innerText(), /Suggestion shown in the editor/)
    assert.equal(await page.locator('.cm-problem-card').count(), 0, 'The problem card stays hidden until the marked line is hovered')
    await page.locator('.cm-problem-line').hover({ position: { x: 12, y: 8 } })
    const card = page.locator('.cm-problem-card')
    assert.match(await card.innerText(), /Synthetic fixture/)
    assert.equal(await card.getByRole('button', { name: 'Apply fix' }).count(), 0, 'Model hints are offered as comments, never as an automatic fix')
    assert.equal(await card.getByRole('button', { name: 'Insert as comment' }).count(), 1)
    await assertSource(page, privateFixtureSource)
    console.log('Explicit hint request is bounded/redacted, uses only the synthetic intercepted endpoint, and leaves code unchanged.')

    delayNextReply = true
    await page.getByRole('button', { name: 'Ask for a hint', exact: true }).click()
    await Promise.race([delayedRequest.promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Delayed fixture request was not sent')), 10_000))])
    const changedSource = 'a=5\nb=7\nfunction total(a,b):\n    print(a-b)\n'
    await replaceCode(page, changedSource)
    await waitForFunctionError(page, 'total')
    delayedReply.release()
    await page.getByRole('button', { name: 'AI error help', exact: true }).waitFor()
    assert.equal(await page.getByRole('status', { name: 'AI error suggestion', exact: true }).count(), 0)
    assert.equal(await page.getByText(staleAnswer, { exact: true }).count(), 0)
    await assertSource(page, changedSource)
    console.log('Editing the source cancels/discards a late hint response.')

    await page.getByLabel('Choose learning track', { exact: true }).selectOption('interview')
    await page.getByLabel('Choose a lesson', { exact: true }).selectOption('refresher-01')
    await page.getByRole('navigation', { name: 'Session stages' }).getByRole('button', { name: /^Independent(, complete)?$/ }).click()
    await replaceCode(page, screenshotSource)
    await waitForFunctionError(page)
    await assertAiBlocked(page)

    await page.getByLabel('Choose a lesson', { exact: true }).selectOption('refresher-12')
    await assertAiBlocked(page)
    await showSession(page)
    await page.getByRole('button', { name: 'Start 60-minute mock', exact: true }).click()
    await replaceCode(page, screenshotSource)
    await waitForFunctionError(page)
    await assertAiBlocked(page)
    await page.getByLabel('Choose learning track', { exact: true }).selectOption('python')
    await waitForFunctionError(page, 'total')
    await assertAiBlocked(page)
    await page.getByLabel('Choose learning track', { exact: true }).selectOption('interview')
    await showSession(page)
    await page.getByRole('button', { name: 'Submit attempt', exact: true }).click()
    await waitForFunctionError(page)
    await assertAiBlocked(page)
    await showSession(page)
    await page.getByRole('button', { name: 'Review attempt', exact: true }).click()
    await assertAiBlocked(page)
    assert.equal(requests.length, 2, 'Restricted phases must not make additional AI requests')
    assert.deepEqual(unexpected, [], 'No actual external provider calls are permitted')
    console.log('AI hints and Settings model tests stay blocked during independent practice, all mock states, and active-mock navigation.')
  } catch (error) {
    console.error('Synthetic route diagnostics:', { calls: requests.length, requestFailures, fixtureFailures, unexpected })
    console.error('Last visible state:', await page.locator('.status-label, .error-card-tip-text, [aria-label="Learning progress"]').allTextContents())
    await page.screenshot({ path: path.join(outDir, 'error-help-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally {
    delayedReply.release()
    await browser.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
