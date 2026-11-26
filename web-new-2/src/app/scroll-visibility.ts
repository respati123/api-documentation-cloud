// Native scrollbars stay hidden until something scrolls. The scrolled element gets data-scrolling for a moment.
const SCROLLING_MS = 900
const timers = new WeakMap<Element, number>()

export function startScrollVisibility(root: Document = document) {
  root.addEventListener(
    'scroll',
    event => {
      const target = event.target instanceof Element ? event.target : root.documentElement
      target.setAttribute('data-scrolling', '')
      window.clearTimeout(timers.get(target))
      timers.set(
        target,
        window.setTimeout(() => target.removeAttribute('data-scrolling'), SCROLLING_MS),
      )
    },
    { capture: true, passive: true },
  )
}
