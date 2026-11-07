import React, { useEffect, useRef, useState } from 'react'
export const ScrollToolbar: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [visible, setVisible] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [placement, setPlacement] = useState({ left: 0, width: 0 })
  const previous = useRef(0)
  useEffect(() => {
    let distance = 0
    const scroll = () => {
      const y = window.scrollY
      const rect = anchor.current?.getBoundingClientRect()
      const delta = previous.current - y
      previous.current = y
      if (rect) setPlacement({ left: rect.left, width: rect.width })
      distance = delta > 0 ? distance + delta : 0
      if (delta < -8 || (rect && rect.bottom >= 64)) setVisible(false)
      else if (distance > 90 && rect && rect.bottom < 64) {
        setQuery(anchor.current?.querySelector<HTMLInputElement>('input')?.value || '')
        setVisible(true)
      }
    }
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', scroll)
    }
  }, [])
  return (
    <>
      <div ref={anchor} className="scroll-toolbar-anchor">
        {children}
      </div>
      <div
        aria-hidden={!visible}
        className={`compact-search ${visible ? 'is-visible' : ''}`}
        style={{ left: placement.left, width: placement.width }}
      >
        <input
          disabled={!visible}
          aria-label="Быстрый поиск по каталогу"
          className="input"
          placeholder="Поиск по каталогу…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            const input = anchor.current?.querySelector<HTMLInputElement>('input')
            if (input) {
              const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
              )?.set
              setter?.call(input, e.target.value)
              input.dispatchEvent(new Event('input', { bubbles: true }))
            }
          }}
        />
      </div>
    </>
  )
}
