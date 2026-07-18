/**
 * Import routes from an OpenAPI 3 document (e.g. companion /openapi.json)
 * into Local API samples and Python request-dict snippets.
 */

import type { LocalApiSample } from './localApi'

export type OpenApiOperation = {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Concrete path with sample path params filled in */
  path: string
  /** Template path from the spec, e.g. /items/{item_id} */
  pathTemplate: string
  summary: string
  hasJsonBody: boolean
  /** Tiny example body when the operation accepts JSON */
  exampleBody?: Record<string, unknown>
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

function fillPathParams(template: string): string {
  // Prefer lesson-friendly samples for known companion routes
  return template
    .replace(/\{item_id\}/gi, 'a1')
    .replace(/\{id\}/gi, 'a1')
    .replace(/\{[^}]+\}/g, 'demo')
}

function exampleFromSchema(schema: unknown): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== 'object') return undefined
  const s = schema as {
    example?: unknown
    properties?: Record<string, { example?: unknown; type?: string }>
    required?: string[]
  }
  if (s.example && typeof s.example === 'object' && !Array.isArray(s.example)) {
    return s.example as Record<string, unknown>
  }
  if (s.properties) {
    const out: Record<string, unknown> = {}
    for (const [key, prop] of Object.entries(s.properties)) {
      if (prop.example !== undefined) out[key] = prop.example
      else if (prop.type === 'string') out[key] = key === 'name' ? 'Ada' : 'demo'
      else if (prop.type === 'integer' || prop.type === 'number') out[key] = 1
      else if (prop.type === 'boolean') out[key] = true
    }
    if (Object.keys(out).length) return out
  }
  return undefined
}

/**
 * Parse OpenAPI 3 (or Swagger-like) JSON into a flat operation list.
 */
export function parseOpenApiDocument(doc: unknown): OpenApiOperation[] {
  if (!doc || typeof doc !== 'object') return []
  const root = doc as {
    paths?: Record<string, Record<string, unknown>>
    components?: { schemas?: Record<string, unknown> }
  }
  const paths = root.paths
  if (!paths || typeof paths !== 'object') return []

  const ops: OpenApiOperation[] = []
  for (const [pathTemplate, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue
    for (const method of METHODS) {
      const op = pathItem[method]
      if (!op || typeof op !== 'object') continue
      const o = op as {
        operationId?: string
        summary?: string
        description?: string
        requestBody?: {
          content?: Record<
            string,
            { schema?: unknown; example?: unknown }
          >
        }
      }
      const jsonContent = o.requestBody?.content?.['application/json']
      let exampleBody: Record<string, unknown> | undefined
      if (jsonContent?.example && typeof jsonContent.example === 'object') {
        exampleBody = jsonContent.example as Record<string, unknown>
      } else if (jsonContent?.schema) {
        exampleBody = exampleFromSchema(jsonContent.schema)
      }
      if (!exampleBody && method === 'post' && /users/i.test(pathTemplate)) {
        exampleBody = { name: 'Ada' }
      }

      const methodUp = method.toUpperCase() as OpenApiOperation['method']
      const path = fillPathParams(pathTemplate)
      const id =
        o.operationId?.trim() ||
        `${methodUp}-${pathTemplate}`.replace(/[^\w-]+/g, '-')
      const summary =
        o.summary?.trim() ||
        o.description?.trim()?.slice(0, 80) ||
        `${methodUp} ${pathTemplate}`

      ops.push({
        id,
        method: methodUp,
        path,
        pathTemplate,
        summary,
        hasJsonBody: Boolean(jsonContent) || method === 'post' || method === 'put',
        exampleBody,
      })
    }
  }

  // Stable order: health first, then path length, then method
  ops.sort((a, b) => {
    if (a.path.includes('health') !== b.path.includes('health')) {
      return a.path.includes('health') ? -1 : 1
    }
    if (a.pathTemplate !== b.pathTemplate) {
      return a.pathTemplate.localeCompare(b.pathTemplate)
    }
    return a.method.localeCompare(b.method)
  })
  return ops
}

export function operationToSample(op: OpenApiOperation): LocalApiSample {
  return {
    id: `oa-${op.id}`,
    label: `${op.method} ${op.pathTemplate}`,
    method: op.method === 'GET' || op.method === 'POST' ? op.method : 'GET',
    path: op.path + (op.path.includes('?') ? '' : ''),
    body:
      op.method === 'POST' || op.method === 'PUT' || op.method === 'PATCH'
        ? op.exampleBody ?? { name: 'Ada' }
        : undefined,
  }
}

/** Python request-dict snippet matching Web APIs lessons. */
export function pythonSnippetForOperation(op: OpenApiOperation): string {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  let body: string = 'None'
  if (op.hasJsonBody && op.exampleBody) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(op.exampleBody).replace(/"/g, "'")
  } else if (op.hasJsonBody) {
    headers['content-type'] = 'application/json'
    body = '{}'
  }

  const headerLit = Object.entries(headers)
    .map(([k, v]) => `'${k}': '${v}'`)
    .join(', ')

  return [
    `# From OpenAPI: ${op.method} ${op.pathTemplate}`,
    `# ${op.summary}`,
    `request = {`,
    `    "method": "${op.method}",`,
    `    "path": "${op.path}",`,
    `    "headers": {${headerLit}},`,
    `    "query": {},`,
    `    "body": ${body},`,
    `}`,
    `print(request)`,
    ``,
  ].join('\n')
}

export async function fetchOpenApiDocument(
  baseUrl: string,
  apiKey = '',
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; operations: OpenApiOperation[] }
  | { ok: false; error: string }
> {
  const base = baseUrl.replace(/\/$/, '')
  const headers: Record<string, string> = { accept: 'application/json' }
  const key = apiKey.trim()
  if (key) {
    headers['x-api-key'] = key
    headers.authorization = `Bearer ${key}`
  }
  try {
    const res = await fetchImpl(`${base}/openapi.json`, { headers })
    if (!res.ok) {
      return {
        ok: false,
        error: `${res.status} loading /openapi.json — is the companion running?`,
      }
    }
    const doc: unknown = await res.json()
    const operations = parseOpenApiDocument(doc)
    if (!operations.length) {
      return { ok: false, error: 'OpenAPI document had no paths.' }
    }
    return { ok: true, operations }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: /Failed to fetch|NetworkError/i.test(message)
        ? 'Offline — start the companion to import OpenAPI.'
        : message,
    }
  }
}
