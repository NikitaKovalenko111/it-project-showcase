import { useEffect } from 'react'

export function AutoSizeTextareas() {
  useEffect(() => {
    const sizes = new WeakMap<HTMLTextAreaElement, string>()
    const resize = (element: HTMLTextAreaElement) => {
      if (!element.getClientRects().length || element.closest('.w-md-editor')) return
      const signature = element.value + ':' + element.clientWidth
      if (sizes.get(element) === signature) return
      element.style.height = 'auto'
      const line = Number.parseFloat(getComputedStyle(element).lineHeight) || 24
      element.style.height = Math.max(line * 4 + 24, element.scrollHeight + 2) + 'px'
      sizes.set(element, signature)
    }
    const scan = () => document.querySelectorAll('textarea').forEach(resize)
    const input = (event: Event) => {
      if (event.target instanceof HTMLTextAreaElement) resize(event.target)
    }
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('input', input)
    window.addEventListener('resize', scan)
    scan()
    return () => {
      observer.disconnect()
      document.removeEventListener('input', input)
      window.removeEventListener('resize', scan)
    }
  }, [])
  return null
}
