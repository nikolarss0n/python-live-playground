import { useLayoutEffect, useRef } from 'react'

const FOCUSABLE = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]'

/** Modal content is portaled to body so its siblings can be made inert without hiding the dialog. */
export function useModalFocus(open: boolean, onClose: () => void) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useLayoutEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let overlay: HTMLElement = element
    while (overlay.parentElement && overlay.parentElement !== document.body) overlay = overlay.parentElement
    const siblings = [...document.body.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== overlay)
      .map((sibling) => ({ element: sibling, inert: sibling.hasAttribute('inert') }))
    siblings.forEach(({ element: sibling }) => sibling.setAttribute('inert', ''))

    const controls = () => [...element.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((control) => {
      if (control.tabIndex < 0 || control.matches(':disabled')) return false
      for (let parent: HTMLElement | null = control; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        if (parent.hidden || parent.hasAttribute('inert') || style.display === 'none' || style.visibility === 'hidden') return false
        if (parent === element) break
      }
      return true
    })
    const focusFirst = () => (controls()[0] ?? element).focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close.current()
      } else if (event.key === 'Tab') {
        const available = controls(), first = available[0], last = available.at(-1)
        if (!first || !last) { event.preventDefault(); element.focus(); return }
        const outside = !element.contains(document.activeElement)
        if (event.shiftKey && (outside || document.activeElement === first)) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && (outside || document.activeElement === last)) {
          event.preventDefault(); first.focus()
        }
      }
    }
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) focusFirst()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus)
    focusFirst()
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocus)
      siblings.forEach(({ element: sibling, inert }) => { if (!inert) sibling.removeAttribute('inert') })
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  return dialog
}
