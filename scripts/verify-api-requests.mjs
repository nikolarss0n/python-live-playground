// Types a FastAPI file into the playground and sends its prepared requests from the API tab, on the real Python worker.
// Usage: node scripts/verify-api-requests.mjs [url] [screenshot-folder]
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const SOURCE = `from fastapi import FastAPI, Header, Query
from pydantic import BaseModel

app = FastAPI()
items = {1: {"name": "Keyboard", "price": 49.0}}

class Item(BaseModel):
    name: str
    price: float
    tags: list[str] = []

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None, limit: int = Query(10, le=50)):
    return {"item_id": item_id, **items[item_id], "q": q, "limit": limit}

@app.post("/items", status_code=201)
def create_item(item: Item, x_token: str = Header()):
    items[len(items) + 1] = item.model_dump()
    return item

@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, x_token: str = Header()):
    del items[item_id]
`

const url = process.argv[2] ?? 'http://localhost:5173'
const shots = process.argv[3]
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })
const errors = []

async function open(viewport) {
  const context = await browser.newContext({ viewport, colorScheme: 'dark' })
  await context.addInitScript(() => { if (!localStorage.getItem('plp-section')) localStorage.setItem('plp-section', 'playground') })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url)
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(SOURCE)
  await page.getByRole('tab', { name: /API/ }).click()
  await page.getByRole('list', { name: 'Routes' }).waitFor({ timeout: 45_000 })
  return page
}

try {
  const page = await open({ width: 1440, height: 900 })
  const routes = page.getByRole('list', { name: 'Routes' }).getByRole('button')
  const response = page.getByRole('status', { name: 'Response' })
  const send = page.getByRole('button', { name: 'Send' })
  const path = page.getByLabel('Request path')
  const sent = async (status) => { await send.click(); await response.getByText(String(status), { exact: true }).waitFor({ timeout: 10_000 }) }

  assert.deepEqual(await routes.allTextContents(), ['GET/items/{item_id}read_item', 'POST/itemscreate_item', 'DELETE/items/{item_id}delete_item'])
  assert.equal(await page.getByRole('tab', { name: /API/ }).textContent(), 'API3')
  assert.equal(await path.inputValue(), '/items/1')
  assert.equal(await page.getByLabel('limit').inputValue(), '10')
  assert.equal(await page.getByLabel('q', { exact: true }).inputValue(), '')
  assert.match(await response.textContent(), /Not sent yet/)

  await sent(200)
  assert.match(await response.textContent(), /'Keyboard'/)
  assert.match(await response.textContent(), /'limit'str:10int/)

  await routes.nth(1).click()
  assert.equal(await page.getByLabel(/x-token/).inputValue(), 'string')
  assert.deepEqual(JSON.parse(await page.getByLabel('Body').inputValue()), { name: 'Example', price: 9.99, tags: [] })
  await sent(201)
  assert.match(await response.textContent(), /Created/)
  if (shots) await page.screenshot({ path: `${shots}/api-requests-desktop.png` })

  // The app keeps its data between sends: the item just created can be read back.
  await routes.nth(0).click()
  await path.fill('/items/2')
  await page.getByLabel('limit').fill('5')
  await path.press('Enter')
  await response.getByText("'Example'").first().waitFor({ timeout: 10_000 })
  assert.match(await response.textContent(), /'limit'str:5int/)

  await page.getByLabel('limit').fill('99')
  await sent(422)
  assert.match(await response.textContent(), /less than or equal to 50/)
  assert.equal(await page.getByLabel('limit').getAttribute('aria-invalid'), 'true', 'the refused field is marked')
  assert.match(await page.getByRole('list', { name: 'What the route refused' }).textContent(), /^limit /)

  await routes.nth(2).click()
  await sent(204)
  assert.match(await response.textContent(), /No content/)
  assert.deepEqual(await routes.locator('.api-status').allTextContents(), ['422', '201', '204'])
  assert.equal(await page.getByRole('tab', { name: /Data/ }).textContent(), 'Data2', 'the Data tab keeps its tables after a Send')

  // A handler that raises answers 500 with a link to the line, and the link moves the editor there.
  await path.fill('/items/99')
  await sent(500)
  await page.getByRole('button', { name: /^Crashed on line \d+$/ }).click()
  assert.match(await page.locator('.cm-activeLine').textContent(), /del items\[item_id\]/)
  await path.fill('/items/1')

  // Running the code again starts the app afresh, so earlier responses go; an edited request stays.
  await page.getByRole('tab', { name: 'Results' }).click()
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.insertText('\n# changed\n')
  await page.getByRole('tab', { name: /API/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Routes"] .api-status').length === 0, null, { timeout: 20_000 })
  await routes.nth(0).click()
  assert.equal(await path.inputValue(), '/items/2')
  await page.context().close()

  const phone = await open({ width: 390, height: 844 })
  await phone.getByRole('list', { name: 'Routes' }).getByRole('button').nth(1).click()
  await phone.getByRole('button', { name: 'Send' }).click()
  await phone.getByRole('status', { name: 'Response' }).getByText('201', { exact: true }).waitFor({ timeout: 10_000 })
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll at phone width')
  const panel = await phone.locator('#fullstack-panel').evaluate((element) => element.scrollWidth <= element.clientWidth)
  assert.equal(panel, true, 'the API tab fits the phone width')
  if (shots) await phone.locator('.pane-results').screenshot({ path: `${shots}/api-requests-phone.png` })

  assert.deepEqual(errors, [])
  console.log('API requests: prepared, sent and answered at desktop and phone width')
} finally {
  await browser.close()
}
