// Exercise file edits and reloads through CodeMirror, local storage and the real Python worker.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const url = process.argv[2] ?? 'http://localhost:5173'
const results = page.getByRole('region', { name: 'Results' })
const picker = page.getByRole('combobox', { name: 'Project', exact: true })
const editor = page.locator('.cm-content')
const errors = []
page.on('pageerror', error => errors.push(error.message))

async function edit(source) {
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(source)
}

async function output(text) {
  await results.locator('.result-text').filter({ hasText: text }).first().waitFor({ timeout: 45_000 })
}

async function firstNumberLeft() {
  return page.locator('.cm-lineNumbers').getByText('1', { exact: true }).evaluate(number => {
    const range = document.createRange()
    range.selectNodeContents(number)
    return range.getBoundingClientRect().left
  })
}

const filesDivider = page.getByRole('separator', { name: 'Resize Files panel' })
const codeDivider = page.getByRole('separator', { name: 'Resize Code and Results panels' })
const panel = selector => page.locator(selector).boundingBox()

async function dragDivider(divider, dx, dy) {
  await divider.scrollIntoViewIfNeeded()
  const box = await divider.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 8 })
  await page.mouse.up()
}

try {
  await page.goto(url)
  await page.getByRole('button', { name: 'Open projects' }).click()
  await output('m*****@example.com')
  await page.getByRole('navigation', { name: 'Project files' }).getByRole('img', { name: '4 results' }).waitFor()

  const originalResults = await panel('.pane-results')
  const originalFiles = await panel('.project-explorer')
  await dragDivider(filesDivider, 80, 0)
  const resizedFiles = await panel('.project-explorer')
  assert.ok(Math.abs(resizedFiles.width - originalFiles.width - 80) < 2)
  assert.equal((await panel('.pane-results')).x, originalResults.x)
  await dragDivider(codeDivider, -120, 0)
  const resizedResults = await panel('.pane-results')
  assert.ok(Math.abs(resizedResults.width - originalResults.width - 120) < 2)
  assert.equal((await panel('.project-explorer')).width, resizedFiles.width)
  await page.reload()
  await codeDivider.waitFor()
  assert.equal((await panel('.pane-results')).width, resizedResults.width)
  assert.equal((await panel('.project-explorer')).width, resizedFiles.width)

  await page.getByRole('tab', { name: 'data/mails.csv' }).click()
  await edit(Array(9).fill('row').join('\n'))
  const numberLeft = await firstNumberLeft()
  await page.keyboard.press('Enter')
  await page.locator('.cm-lineNumbers').getByText('10', { exact: true }).waitFor()
  assert.equal(await firstNumberLeft(), numberLeft, 'Line numbers shifted when line 10 appeared')
  await edit('email\njules@sample.org\n')
  await output('j****@sample.org')

  await page.getByRole('button', { name: 'New file', exact: true }).click()
  await page.getByRole('textbox', { name: 'File path' }).fill('helpers/greet.py')
  await page.getByRole('button', { name: 'Create file' }).click()
  await edit('def greet():\n    print("Hello from a helper")\n')
  await page.getByRole('tab', { name: 'main.py', exact: true }).click()
  await edit('from helpers.greet import greet\ngreet()\n')
  await output('Hello from a helper')
  await results.getByRole('button', { name: 'helpers/greet.py' }).click()
  assert.equal(await page.getByRole('tab', { selected: true }).getAttribute('aria-label'), 'helpers/greet.py')
  await edit('def greet():\n    raise ValueError("broken helper")\n')
  await results.getByText('broken helper', { exact: false }).first().waitFor()
  await page.getByRole('navigation', { name: 'Project files' }).getByRole('img', { name: '1 error' }).waitFor()
  await edit('def greet():\n    print("Fixed helper")\n')
  await output('Fixed helper')

  await edit('def greet():\n    while True:\n        pass\n')
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await results.locator('.status-label-stopped').waitFor()
  const autoRun = page.getByRole('switch', { name: 'Auto-run' })
  assert.equal(await autoRun.getAttribute('aria-checked'), 'true')
  assert.equal(await page.getByRole('button', { name: 'Run', exact: true }).count(), 0)
  await autoRun.click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await results.locator('.status-label-timeout').waitFor()
  await page.reload()
  assert.equal(await autoRun.getAttribute('aria-checked'), 'false')
  await autoRun.click()
  await edit('def greet():\n    print("Fixed helper")\n')
  await output('Fixed helper')

  await picker.selectOption('new')
  await page.getByLabel('Project name').fill('second project')
  await page.getByRole('button', { name: 'Create project' }).click()
  await output('Hello, Python!')
  await page.getByRole('button', { name: 'New file', exact: true }).click()
  await page.getByRole('textbox', { name: 'File path' }).fill('start.py')
  await page.getByRole('button', { name: 'Create file' }).click()
  await edit('print("Alternate entry")\n')
  await page.getByRole('button', { name: 'Actions for start.py' }).click()
  await page.getByRole('button', { name: 'Set as entry file' }).click()
  await output('Alternate entry')
  await page.getByRole('button', { name: 'Actions for start.py' }).click()
  await page.getByRole('button', { name: /Rename/ }).click()
  await page.getByLabel('New file path').fill('app/start.py')
  await page.getByRole('button', { name: 'Save path' }).click()
  await results.getByRole('button', { name: 'app/start.py', exact: true }).waitFor()
  await page.getByRole('tab', { name: 'main.py', exact: true }).click()
  await page.getByRole('button', { name: 'Actions for main.py' }).click()
  await page.getByRole('button', { name: 'Delete file…', exact: true }).click()
  await page.getByRole('button', { name: 'Delete file', exact: true }).click()
  assert.equal(await page.getByRole('tab', { name: 'main.py', exact: true }).count(), 0)
  await picker.selectOption({ label: 'mail-tools' })
  await output('Fixed helper')
  await page.reload()
  await output('Fixed helper')
  assert.equal(await page.getByRole('tab', { selected: true }).getAttribute('aria-label'), 'helpers/greet.py')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => document.querySelector('.split')?.getAttribute('aria-orientation') === 'horizontal')
  const stackedCode = await panel('.pane-editor')
  await dragDivider(codeDivider, 0, 60)
  assert.ok(Math.abs((await panel('.pane-editor')).height - stackedCode.height - 60) < 2)
  await codeDivider.press('ArrowUp')
  assert.ok((await panel('.pane-editor')).height < stackedCode.height + 59)
  await page.getByRole('button', { name: 'Open project files' }).click()
  const drawer = page.getByRole('dialog', { name: 'Project explorer' })
  await drawer.getByRole('button', { name: /mails.csv/ }).click()
  assert.equal(await drawer.count(), 0)
  assert.ok((await editor.innerText()).includes('jules@sample.org'))
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

  // Inspect the project without executing the edited Python.
  await autoRun.click()
  await page.getByRole('tab', { name: 'main.py', exact: true }).click()
  await edit('def trace(fn):\n    def wrapped(arg): return fn(arg)\n    return wrapped\nraise RuntimeError("review must not run code")')
  await page.getByRole('tab', { name: 'helpers/greet.py', exact: true }).click()
  await picker.selectOption('patterns')
  const report = page.getByRole('dialog', { name: 'Design patterns' })
  await report.getByRole('heading', { name: 'Function decorator' }).waitFor()
  await report.getByRole('button', { name: 'main.py:2' }).click()
  assert.equal(await page.getByRole('tab', { selected: true }).getAttribute('aria-label'), 'main.py')
  assert.equal(await page.locator('.cm-activeLine').first().innerText(), '    def wrapped(arg): return fn(arg)')
  await edit('from helpers.greet import greet\ngreet()\n')
  await autoRun.click()
  await output('Fixed helper')

  await picker.selectOption('scratchpad')
  await page.getByRole('button', { name: 'Open projects' }).waitFor()
  assert.equal(await page.getByRole('group', { name: 'Lesson navigation' }).count(), 0)
  await page.getByRole('button', { name: 'Open projects' }).click()
  await output('Fixed helper')
  await page.goto(new URL('/?lesson=printing', url).href)
  await page.getByRole('group', { name: 'Lesson navigation' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Project imports, data, Stop/timeout, file actions, entry selection, persistence, mobile drawer, and lesson navigation passed.')
} finally {
  await browser.close()
}
