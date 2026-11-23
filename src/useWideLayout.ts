import { useEffect, useState } from 'react'

export function useWideLayout(minWidth = 801): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= minWidth : true,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [minWidth])
  return wide
}
