/** Design acceptance only: every context intercepts Jev before loading the app. */
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const sizes = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 700 }]
const failures = []
const checks = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']
const executed = new Set()
function report(check, state, issues) {
  executed.add(check)
  for (const issue of issues) {
    const line = `${check} FAIL ${state} | ${issue}`
    failures.push(line)
    console.error(line)
  }
  if (!issues.length) console.log(`${check} PASS ${state}`)
}

/** Runs in the page. Compose backgrounds and opacity groups, not only the nearest CSS color. */
function measureText() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas color conversion unavailable')
  const color = (css) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r / 255, g / 255, b / 255, a / 255]
  }
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3])
    return a ? [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0]
  }
  const luminance = (rgba) => rgba.slice(0, 3).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  const split = (value) => {
    const parts = []; let depth = 0; let start = 0
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '(') depth++
      if (value[i] === ')') depth--
      if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1 }
    }
    return [...parts, value.slice(start).trim()]
  }
  const gradient = (value, element, point) => {
    const match = /^linear-gradient\((.*)\)$/.exec(value)
    if (!match) throw new Error(`unsupported background ${value}`)
    const parts = split(match[1])
    let direction = 'to bottom'
    if (/^(?:to |[-\d.]+deg)/.test(parts[0])) direction = parts.shift()
    const rect = element.getBoundingClientRect()
    const horizontal = /right|left|90deg|270deg/.test(direction)
    const reverse = /top|left|^0deg|270deg/.test(direction)
    const distance = horizontal ? rect.width : rect.height
    let position = (horizontal ? point.x - rect.left : point.y - rect.top) / distance
    if (reverse) position = 1 - position
    const stops = parts.map((part, index) => {
      const stop = /^(.*?)(?:\s+([-\d.]+)(%|px))?$/.exec(part)
      return { color: color(stop[1]), at: stop[2] === undefined ? index / (parts.length - 1) : Number(stop[2]) / (stop[3] === '%' ? 100 : distance) }
    })
    const upper = stops.findIndex((stop) => stop.at >= position)
    if (upper === 0) return stops[0].color
    if (upper < 0) return stops.at(-1).color
    const left = stops[upper - 1], right = stops[upper]
    const t = (position - left.at) / (right.at - left.at || 1)
    const a = left.color[3] * (1 - t) + right.color[3] * t
    return a ? [0, 1, 2].map((i) => (left.color[i] * left.color[3] * (1 - t) + right.color[i] * right.color[3] * t) / a).concat(a) : [0, 0, 0, 0]
  }
  const background = (element, style, point) => {
    let result = color(style.backgroundColor)
    if (style.backgroundImage !== 'none') {
      // The select's two 4px arrow images are outside its text area.
      if (element instanceof HTMLSelectElement && style.backgroundSize.startsWith('4px 4px')) return result
      for (const layer of split(style.backgroundImage).reverse()) result = over(gradient(layer, element, point), result)
    }
    return result
  }
  const name = (element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${[...element.classList].map((c) => `.${c}`).join('')}`
  const hidden = (element) => element.closest('.sr-only, [aria-hidden="true"], [disabled], [aria-disabled="true"], script, style, option')
  const visiblePoints = (element, rects) => {
    if (hidden(element)) return []
    const points = []
    for (const rect of rects) {
      let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right)
      let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom)
      for (let parent = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) { right = left; break }
        const clip = parent.getBoundingClientRect()
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right) }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom) }
      }
      if (right <= left || bottom <= top) continue
      for (const fraction of [0.2, 0.5, 0.8]) {
        const point = { x: left + (right - left) * fraction, y: (top + bottom) / 2 }
        const hit = document.elementFromPoint(point.x, point.y)
        if (hit && (hit === element || element.contains(hit))) points.push(point)
      }
    }
    return points
  }
  const issues = { D1: [], D2: [] }
  const inspect = (element, text, rects, pseudo = null) => {
    const points = visiblePoints(element, rects)
    if (!points.length || !text.trim()) return
    const style = getComputedStyle(element, pseudo)
    const size = parseFloat(style.fontSize)
    const minimum = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight, 10) >= 700) ? 3 : 4.5
    const floor = element.closest('#lesson-details, [aria-label="Goal checks"]') && style.textTransform !== 'uppercase' ? 13 : 11
    const label = `${name(element)}${pseudo ?? ''} ${JSON.stringify(text.trim().slice(0, 90))}`
    if (size + 0.01 < floor) issues.D2.push(`${label}: ${size.toFixed(2)}px < ${floor}px`)
    try {
      let worst = Infinity
      for (const point of points) {
        let ink = color(style.color), blank = [0, 0, 0, 0]
        if (pseudo) ink[3] *= Number(style.opacity)
        for (let parent = element; parent; parent = parent.parentElement) {
          const parentStyle = getComputedStyle(parent), bg = background(parent, parentStyle, point)
          ink = over(ink, bg); blank = over(blank, bg)
          ink[3] *= Number(parentStyle.opacity); blank[3] *= Number(parentStyle.opacity)
        }
        worst = Math.min(worst, contrast(over(ink, [1, 1, 1, 1]), over(blank, [1, 1, 1, 1])))
      }
      if (worst + 0.005 < minimum) issues.D1.push(`${label}: ${worst.toFixed(2)}:1 < ${minimum}:1`)
    } catch (error) { issues.D1.push(`${label}: could not measure: ${error.message}`) }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!node.parentElement || !node.textContent.trim()) continue
    const range = document.createRange(); range.selectNodeContents(node)
    inspect(node.parentElement, node.textContent, [...range.getClientRects()])
  }
  for (const element of document.querySelectorAll('input:not([type="hidden"]), textarea, select')) {
    const rects = [element.getBoundingClientRect()]
    if (element instanceof HTMLSelectElement) inspect(element, element.selectedOptions[0]?.textContent ?? '', rects)
    else if (element.value) inspect(element, element.type === 'password' ? '••••' : element.value, rects)
    else if (element.placeholder) inspect(element, element.placeholder, rects, '::placeholder')
  }
  return { D1: [...new Set(issues.D1)], D2: [...new Set(issues.D2)] }
}

function measureBox() {
  const box = document.querySelector('#lesson-details')
  if (!box || box.hidden) return ['#lesson-details is not open']
  const rect = box.getBoundingClientRect(), issues = []
  const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
  for (const selector of ['.code-editor', '.editor-pills', '.pane-editor > .pane-head', '.results-head', '.toolbar', '.app-footer']) {
    for (const element of document.querySelectorAll(selector)) if (intersects(rect, element.getBoundingClientRect())) issues.push(`#lesson-details overlaps ${selector}`)
  }
  const pane = document.querySelector('.pane-results').getBoundingClientRect()
  const header = document.querySelector('.results-head').getBoundingClientRect()
  if (rect.left < pane.left - 1 || rect.right > pane.right + 1 || rect.top < header.bottom - 1 || rect.bottom > pane.bottom + 1) issues.push('#lesson-details crosses the Results pane bounds or header')
  if (rect.width <= 0 || rect.height <= 0) issues.push('#lesson-details has no usable area')
  if (box.scrollWidth > box.clientWidth + 1) issues.push(`#lesson-details sideways scroll: ${box.scrollWidth - box.clientWidth}px`)
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(`page sideways scroll: ${document.documentElement.scrollWidth - innerWidth}px`)
  const results = document.querySelector('.results-panel')
  const walker = document.createTreeWalker(results, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode, element = node.parentElement
    if (!element || !node.textContent.trim() || element.closest('.sr-only, [aria-hidden="true"]')) continue
    const range = document.createRange(); range.selectNodeContents(node)
    for (const textRect of range.getClientRects()) {
      let left = Math.max(0, textRect.left), right = Math.min(innerWidth, textRect.right, rect.left)
      let top = Math.max(0, textRect.top, rect.top), bottom = Math.min(innerHeight, textRect.bottom, rect.bottom)
      for (let parent = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), clip = parent.getBoundingClientRect()
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) { right = left; break }
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right) }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom) }
      }
      if (right - left <= 0.5 || bottom - top <= 0.5) continue
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
      if (hit && element.contains(hit)) issues.push(`${element.tagName.toLowerCase()}.${[...element.classList].join('.')} ${JSON.stringify(node.textContent.trim().slice(0, 70))} peeks left of #lesson-details: text x=${textRect.left.toFixed(1)}, box x=${rect.left.toFixed(1)}`)
    }
  }
  return [...new Set(issues)]
}

async function boxFocus(page) {
  const issues = []
  await page.locator('.lesson-pill').focus()
  let inside = false
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    const where = await page.evaluate(() => ({ box: Boolean(document.activeElement?.closest('#lesson-details')), editor: Boolean(document.activeElement?.closest('.cm-editor')) }))
    if (where.box) { inside = true; break }
    if (where.editor) break
  }
  if (!inside) issues.push('Tab from .lesson-pill did not reach a box control before .cm-content')
  else {
    await page.keyboard.press('Escape')
    if (await page.locator('#lesson-details').isVisible()) issues.push('Escape did not close #lesson-details')
    if (!await page.locator('.lesson-pill').evaluate((el) => el === document.activeElement)) issues.push('Escape did not return focus to .lesson-pill')
  }
  return issues
}

async function openDialog(page, kind) {
  const trigger = kind === 'settings' ? page.getByRole('button', { name: 'Open settings' }) : page.getByRole('button', { name: /shortcuts/i })
  if (await trigger.count()) { await trigger.focus(); await page.keyboard.press('Enter') }
  else { await page.locator('.lesson-pill').focus(); await page.keyboard.press('?') }
  const dialog = page.getByRole('dialog', { name: kind === 'settings' ? 'Settings' : 'Keyboard shortcuts' })
  await dialog.waitFor()
  return { dialog, trigger, initialFocusInside: await dialog.evaluate((el) => el.contains(document.activeElement)) }
}

async function dialogFocus(page, dialog, trigger, initialFocusInside) {
  const issues = []
  const inside = () => dialog.evaluate((el) => el.contains(document.activeElement))
  if (!initialFocusInside) issues.push('opening the dialog did not move focus inside')
  if (await dialog.getAttribute('aria-modal') !== 'true') issues.push('dialog lacks aria-modal=true')
  for (const direction of ['Tab', 'Shift+Tab']) for (let i = 0; i < 10; i++) {
    await page.keyboard.press(direction)
    if (!await inside()) issues.push(`${direction} ${i + 1} escaped the dialog`)
  }
  const backgroundInert = await page.locator('.toolbar').evaluate((el) => Boolean(el.closest('[inert]')))
  if (!backgroundInert) issues.push('.toolbar is not inert behind the dialog')
  await page.keyboard.press('Escape')
  if (await dialog.isVisible()) issues.push('Escape did not close the dialog')
  if (!await trigger.count() || !await trigger.evaluate((el) => el === document.activeElement)) issues.push('closing did not restore the opening control')
  return [...new Set(issues)]
}

async function editorExit(page) {
  const issues = [], editor = page.locator('.cm-content')
  await editor.focus(); await page.keyboard.press('Tab')
  if (!await editor.evaluate((el) => el.contains(document.activeElement))) issues.push('Tab escaped .cm-content without Escape')
  await page.keyboard.press('Escape'); await page.keyboard.press('Tab')
  if (await editor.evaluate((el) => el.contains(document.activeElement))) issues.push('Escape then Tab did not leave .cm-content')
  const { dialog } = await openDialog(page, 'shortcuts')
  if (!/leave the editor/i.test(await dialog.innerText())) issues.push('Shortcuts does not explain how to leave the editor')
  const description = await editor.evaluate((el) => (el.getAttribute('aria-describedby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') + (el.getAttribute('aria-description') ?? ''))
  if (!/Esc then Tab: leave the editor/i.test(description)) issues.push('.cm-content has no accessible exit description')
  await page.keyboard.press('Escape')
  return issues
}

async function focusRings(page) {
  const issues = [], visited = new Set()
  const modal = page.getByRole('dialog')
  if (!await modal.count()) await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex') })
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const style = getComputedStyle(el)
      const path = []; for (let node = el; node && node !== document.body; node = node.parentElement) path.unshift(`${node.tagName.toLowerCase()}:nth-child(${[...node.parentElement.children].indexOf(node) + 1})`)
      return { key: path.join(' > '), label: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.getAttribute('aria-label') ?? ''}`, editor: Boolean(el.closest('.cm-editor')), width: parseFloat(style.outlineWidth), style: style.outlineStyle, color: style.outlineColor }
    })
    if (!stop || visited.has(stop.key)) break
    visited.add(stop.key)
    if (!stop.editor && (stop.width < 2 || stop.style === 'none' || stop.color === 'transparent' || stop.color === 'rgba(0, 0, 0, 0)')) issues.push(`${stop.label}: outline ${stop.width}px ${stop.style} ${stop.color}`)
    if (stop.editor) await page.keyboard.press('Escape')
    if (i === 119) issues.push('Tab walk did not finish within 120 stops')
  }
  if (!visited.size) issues.push('Tab walk reached no controls')
  return issues
}

const browser = await chromium.launch()
try {
  for (const theme of ['light', 'dark']) for (const viewport of sizes) for (const lesson of ['printing', 'missing-data-none']) {
    const states = ['starter', 'lesson-open', ...(viewport.width === 1440 ? ['valid', 'syntax-error', ...(lesson === 'printing' ? ['blank-error'] : []), 'settings', 'shortcuts'] : [])]
    for (const state of states) {
      const label = `${theme} ${viewport.width}x${viewport.height} ${lesson} ${state}`
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
      await context.route('**/api/jev/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Jev is stubbed by verify:design.' }) }))
      await context.addInitScript((mode) => localStorage.setItem('plp-theme', mode), theme)
      const page = await context.newPage()
      try {
        await page.goto(`${baseUrl}/?lesson=${lesson}`)
        await page.locator('.cm-content').waitFor()
        await page.evaluate(() => document.fonts.ready)
        let opened
        if (state === 'lesson-open') await page.locator('.lesson-pill').click()
        if (state === 'settings' || state === 'shortcuts') opened = await openDialog(page, state)
        if (state === 'valid' || state === 'syntax-error' || state === 'blank-error') {
          let source = 'print("Hello"'
          if (state === 'valid') {
            const starter = await page.locator('.cm-content').innerText()
            const answers = ['"label"', 'None', '1']; let index = 0
            source = lesson === 'printing' ? 'print("Hello, Ada!")\nprint("I am learning Python")\n' : starter.replace(/\?\?\?/g, () => answers[index++])
          }
          if (state === 'blank-error') {
            const starter = await page.locator('.cm-content').innerText()
            source = starter.replace('"Hello, world!"', '"Hi"')
            if (source === starter || !source.includes('???')) throw new Error('The blank-error state must edit the greeting and retain the blank')
          }
          await page.locator('.cm-content').click()
          await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(source)
          await page.keyboard.press('ControlOrMeta+Enter')
          if (state === 'valid') await page.locator('.goal-checks').waitFor({ timeout: 60000 })
          else await page.locator('.error-card').waitFor({ timeout: 60000 })
          if (state === 'blank-error') {
            await page.locator('.cm-problem-line .cm-problem-mark .cm-blank-token, .cm-problem-line .cm-blank-token .cm-problem-mark, .cm-problem-line .cm-blank-token.cm-problem-mark').first().waitFor({ timeout: 60000 })
          }
        }
        await page.waitForTimeout(250) // Let existing short transitions settle; do not measure an animation frame.
        const text = await page.evaluate(measureText)
        report('D1', label, text.D1); report('D2', label, text.D2)
        if (state === 'lesson-open') {
          report('D3', label, await page.evaluate(measureBox)); report('D4', label, await boxFocus(page))
          if (!await page.locator('#lesson-details').isVisible()) await page.locator('.lesson-pill').click()
        }
        if (state === 'starter') report('D6', label, await editorExit(page))
        report('D7', label, await focusRings(page))
        if (opened) report('D5', label, await dialogFocus(page, opened.dialog, opened.trigger, opened.initialFocusInside))
      } catch (error) { report('SETUP', label, [error.message]) }
      finally { await context.close() }
    }
  }
} finally { await browser.close() }
for (const check of checks) console.log(`${check}: ${!executed.has(check) ? 'NOT RUN' : failures.some((line) => line.startsWith(check + ' ')) ? 'FAIL' : 'PASS'}`)
if (failures.length || checks.some((check) => !executed.has(check))) process.exitCode = 1
