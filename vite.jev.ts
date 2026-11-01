import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { forwardJev, JEV_MAX_REQUEST_BYTES, JEV_ROUTE } from './src/jev/forward.ts'

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return req.headers['sec-fetch-site'] !== 'cross-site'
  try { return new URL(origin).host === req.headers.host } catch { return false }
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      if (size > JEV_MAX_REQUEST_BYTES) { resolve(null); req.destroy() } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

function send(res: ServerResponse, status: number, body: string) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

/** Local-only Jev bridge: the browser posts `{ state, questions }`, the server adds TYPESAFE_API_KEY and TYPESAFE_MODEL. */
export function jevProxy(env: Record<string, string | undefined>): Plugin {
  const apiKey = env.TYPESAFE_API_KEY ?? ''
  const model = env.TYPESAFE_MODEL ?? 'jev-latest'
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url !== JEV_ROUTE) return next()
    if (!sameOrigin(req)) return send(res, 403, JSON.stringify({ error: 'Cross-origin Jev requests are not allowed.' }))
    if (req.method === 'GET') return send(res, 200, JSON.stringify({ configured: apiKey.trim().length > 0 }))
    if (req.method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) {
      return send(res, 405, JSON.stringify({ error: 'Use POST with a JSON body.' }))
    }
    void readBody(req).then(async (body) => {
      if (body === null) return send(res, 413, JSON.stringify({ error: 'The Jev request is too large.' }))
      const result = await forwardJev(body, { apiKey, model })
      send(res, result.status, result.body)
    })
  }
  return {
    name: 'python-live-jev-proxy',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
