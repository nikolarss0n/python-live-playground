import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SimulatedRouteList } from './SimulatedRouteList'

describe('SimulatedRouteList', () => {
  it('calls GET /hello with the edited path only', async () => {
    const user = userEvent.setup()
    const onCall = vi.fn()
    render(
      <SimulatedRouteList
        routes={[{ method: 'GET', path: '/hello', callPath: '/hello' }]}
        onCall={onCall}
      />,
    )
    await user.click(screen.getByRole('button', { name: /call get \/hello/i }))
    expect(onCall).toHaveBeenCalledWith({
      method: 'GET',
      path: '/hello',
    })
  })

  it('sends JSON body, query, and headers on POST', async () => {
    const user = userEvent.setup()
    const onCall = vi.fn()
    render(
      <SimulatedRouteList
        routes={[{ method: 'POST', path: '/users', callPath: '/users' }]}
        onCall={onCall}
      />,
    )

    fireEvent.change(screen.getByLabelText(/json body/i), {
      target: { value: '{"name":"Ada","tags":["admin"]}' },
    })
    await user.click(screen.getByRole('button', { name: /query & headers/i }))
    fireEvent.change(screen.getByLabelText(/^query for /i), {
      target: { value: 'verbose=1' },
    })
    fireEvent.change(screen.getByLabelText(/^headers for /i), {
      target: { value: 'Authorization: Bearer secret' },
    })
    await user.click(screen.getByRole('button', { name: /call post \/users/i }))

    expect(onCall).toHaveBeenCalledWith({
      method: 'POST',
      path: '/users',
      query: { verbose: '1' },
      body: { name: 'Ada', tags: ['admin'] },
      headers: { Authorization: 'Bearer secret' },
    })
  })

  it('lets path params be edited before Call', async () => {
    const user = userEvent.setup()
    const onCall = vi.fn()
    render(
      <SimulatedRouteList
        routes={[{ method: 'GET', path: '/items/{item_id}', callPath: '/items/1' }]}
        onCall={onCall}
      />,
    )
    const path = screen.getByLabelText(/path for get \/items\/\{item_id\}/i)
    fireEvent.change(path, { target: { value: '/items/7' } })
    await user.click(
      screen.getByRole('button', { name: /call get \/items\/\{item_id\}/i }),
    )
    expect(onCall).toHaveBeenCalledWith({
      method: 'GET',
      path: '/items/7',
    })
  })

  it('does not Call POST with the empty placeholder body', async () => {
    const user = userEvent.setup()
    const onCall = vi.fn()
    render(
      <SimulatedRouteList
        routes={[{ method: 'POST', path: '/users', callPath: '/users' }]}
        onCall={onCall}
      />,
    )
    await user.click(screen.getByRole('button', { name: /call post \/users/i }))
    expect(onCall).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/json body/i)
  })

  it('blocks Call and shows an error when body JSON is invalid', async () => {
    const user = userEvent.setup()
    const onCall = vi.fn()
    render(
      <SimulatedRouteList
        routes={[{ method: 'POST', path: '/users', callPath: '/users' }]}
        onCall={onCall}
      />,
    )
    fireEvent.change(screen.getByLabelText(/json body for post \/users/i), {
      target: { value: '{name:}' },
    })
    await user.click(screen.getByRole('button', { name: /call post \/users/i }))
    expect(onCall).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/json/i)
  })
})
