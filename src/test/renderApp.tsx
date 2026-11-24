import { render, screen } from '@testing-library/react'
import App from '../App'

/** Renders App and waits for any lazy-loaded workspace chunk to finish mounting. */
export async function renderApp() {
  const result = render(<App />)
  await screen.findByRole('heading', { name: /python live/i })
  return result
}
