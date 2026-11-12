import { useEffect } from 'react'

const HIDE_AFTER_MS = 700

// Marks whichever element is scrolling with data-scrolling, and clears it shortly after scrolling stops.
// index.css shows the native scrollbar only while the mark is there, so every scroll container behaves the same.
export function useScrollActivity() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>()
    const onScroll = (event: Event) => {
      const element = event.target instanceof Element ? event.target : document.documentElement
      element.setAttribute('data-scrolling', '')
      window.clearTimeout(timers.get(element))
      timers.set(
        element,
        window.setTimeout(() => element.removeAttribute('data-scrolling'), HIDE_AFTER_MS),
      )
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [])
}
