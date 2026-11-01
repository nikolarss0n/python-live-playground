/**
 * Headless check of in-playground FastAPI TestClient + Call form.
 * Usage: node scripts/verify-fastapi-sim.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = path.resolve('refs/verify')

const source = `from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

class User(BaseModel):
    name: str
    tags: list[str] = []

app = FastAPI()

@app.post("/users", status_code=201)
def create(user: User, authorization: str | None = Header(default=None)):
    if authorization != "Bearer secret":
        raise HTTPException(status_code=401, detail="nope")
    return {"id": 1, "name": user.name, "tags": user.tags}

@app.get("/greet")
def greet(name: str = "world"):
    return {"message": f"Hello, {name}!"}

client = TestClient(app)
print(client.post("/users", json={"name": "Ada", "tags": ["admin"]}, headers={"Authorization": "Bearer secret"}))
print(client.get("/greet", params={"name": "Ada"}))
print(client.get("/nope"))
`

async function replaceCode(page, code) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
  await page.keyboard.press('ControlOrMeta+Enter')
}

function cardHas(page, pattern) {
  return page.waitForFunction((reSource) => {
    const re = new RegExp(reSource)
    return [...document.querySelectorAll('.http-card')].some((el) =>
      re.test(el.textContent || ''),
    )
  }, pattern)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(90_000)

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.app-shell')
  await page.waitForFunction(() => {
    const el = document.querySelector('.status-label')
    return !el || !/Loading Python/i.test(el.textContent || '')
  }, null, { timeout: 120_000 })

  await replaceCode(page, source)
  await cardHas(page, 'POST /users[\\s\\S]*201[\\s\\S]*Ada')
  await cardHas(page, 'GET /nope[\\s\\S]*404')

  await page.getByRole('group', { name: /simulated api routes/i }).waitFor()
  await page
    .getByLabel(/json body for post \/users/i)
    .fill('{"name":"Ada","tags":["ops"]}')
  await page
    .getByRole('button', { name: /query & headers for post \/users/i })
    .click()
  await page
    .getByRole('textbox', { name: /headers for post \/users/i })
    .fill('Authorization: Bearer secret')
  await page.getByRole('button', { name: /call post \/users/i }).click()
  await cardHas(page, 'POST /users[\\s\\S]*201[\\s\\S]*ops')

  await page.getByRole('button', { name: /call get \/greet/i }).click()
  await cardHas(page, 'GET /greet[\\s\\S]*Hello, world')

  await page.screenshot({
    path: path.join(outDir, 'fastapi-desktop.png'),
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  if (scrollWidth > clientWidth + 1) {
    throw new Error(`narrow overflow: ${scrollWidth} > ${clientWidth}`)
  }
  await page.screenshot({
    path: path.join(outDir, 'fastapi-narrow.png'),
    fullPage: true,
  })

  console.log('OK TestClient prints + Call form (desktop and 390px)')
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
