/**
 * Where the page's AI checks send their `{ state, questions }` requests. In a browser that is the dev server's
 * `/api/jev` route; the macOS app swaps in Apple's on-device model (`src/host/macAi.ts`) before the app renders.
 */

let transport: typeof fetch = (input, init) => fetch(input, init)

export function jevFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return transport(input, init)
}

export function setJevTransport(next: typeof fetch): void {
  transport = next
}
