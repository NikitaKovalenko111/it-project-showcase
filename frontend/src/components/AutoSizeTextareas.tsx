import { useEffect } from 'react'

export function AutoSizeTextareas() {
  useEffect(() => {
    const sizes = new WeakMap<HTMLTextAreaElement, string>()
    const resize = (element: HTMLTextAreaElement) => {
      if (!element.getClientRects().length || element.closest('.w-md-editor')) return
      const signature = element.value + ':' + element.clientWidth
      if (sizes.get(element) === signature) return
      element.style.height = 'auto'
      const style = getComputedStyle(element)
      const line = Number.parseFloat(style.lineHeight) || 24
      const rows = Number(element.dataset.minRows) || 4
      const padding =
        Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) + 2
      const desired = Math.max(line * rows + padding, element.scrollHeight + 2)
      const maximum = Number.parseFloat(style.maxHeight)
      element.style.height = Math.min(desired, maximum || Infinity) + 'px'
      element.style.overflowY = maximum && desired > maximum ? 'auto' : 'hidden'
      sizes.set(element, signature)
    }
    const scan = () => document.querySelectorAll('textarea').forEach(resize)
    const input = (event: Event) => {
      if (event.target instanceof HTMLTextAreaElement) resize(event.target)
    }
    const observer = new MutationObserver(scan)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    })
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
