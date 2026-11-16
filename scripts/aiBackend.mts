// Picks the model behind the live AI checks in verify-jev*.mts.
//   default            TypeSafe through forwardJev (needs TYPESAFE_API_KEY in .env.local; paid)
//   --backend apple    Apple's on-device model through macos' `playground-ai` CLI (macOS 27, free, offline)
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { forwardJev } from '../src/jev/forward.ts'
import { toOrderedChoiceRequest } from '../src/host/macAi.ts'

const json = (body: string, status: number) => new Response(body, { status, headers: { 'content-type': 'application/json' } })

//   --backend apple-cloud  Apple's larger model on Private Cloud Compute through the same CLI
const requested = process.argv.includes('--backend') ? process.argv[process.argv.indexOf('--backend') + 1] : ''
export const backendName = requested === 'apple' || requested === 'apple-cloud' ? requested : 'typesafe'

function appleFetch(): typeof fetch {
  const root = new URL('../macos', import.meta.url).pathname
  const build = spawnSync('swift', ['build', '--package-path', root, '-c', 'release', '--product', 'playground-ai'], { stdio: 'inherit' })
  if (build.status !== 0) { console.error('Could not build playground-ai'); process.exit(1) }
  const bin = `${spawnSync('swift', ['build', '--package-path', root, '-c', 'release', '--show-bin-path'], { encoding: 'utf8' }).stdout.trim()}/playground-ai`
  return (async (_url: string, init: RequestInit) => {
    const request = toOrderedChoiceRequest(JSON.parse(String(init.body)))
    if (!request) return json('{"error":"not a choice request"}', 400)
    const output = await new Promise<{ code: number | null; text: string }>((resolve) => {
      const child = spawn(bin, backendName === 'apple-cloud' ? ['--cloud'] : [], { stdio: ['pipe', 'pipe', 'inherit'] })
      let text = ''
      child.stdout.on('data', (chunk) => { text += chunk })
      child.on('close', (code) => resolve({ code, text }))
      child.stdin.end(JSON.stringify(request))
    })
    return json(output.text || '{"error":"no output"}', output.code === 0 ? 200 : 503)
  }) as typeof fetch
}

function typesafeFetch(): typeof fetch {
  const envFile = new URL('../.env.local', import.meta.url)
  const env = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split('\n')
    .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter((match) => match !== null).map((match) => [match[1], match[2].replace(/^["']|["']$/g, '')])) : {}
  const apiKey = env.TYPESAFE_API_KEY ?? process.env.TYPESAFE_API_KEY ?? ''
  if (!apiKey) { console.error('TYPESAFE_API_KEY is not set in .env.local (or pass --backend apple)'); process.exit(1) }
  return (async (_url: string, init: RequestInit) => {
    const result = await forwardJev(String(init.body), { apiKey, model: env.TYPESAFE_MODEL ?? 'jev-latest' })
    return json(result.body, result.status)
  }) as typeof fetch
}

export const backendFetch = (): typeof fetch => backendName === 'typesafe' ? typesafeFetch() : appleFetch()
