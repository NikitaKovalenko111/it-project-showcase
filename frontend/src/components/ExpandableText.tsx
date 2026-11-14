import { useId, useLayoutEffect, useRef, useState } from 'react'

export function ExpandableText({ text, compact = false }: { text: string; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const body = useRef<HTMLParagraphElement>(null)
  const id = useId()
  useLayoutEffect(() => {
    const element = body.current
    if (!element) return
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || 21
      setOverflowing(element.scrollHeight > lineHeight * (compact ? 4 : 6) + 2)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, compact])
  return (
    <div className={compact ? 'expandable-text expandable-text--card' : 'expandable-text'}>
      <p
        style={{
          lineHeight: 1.65,
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
          ...(!expanded ? { maxHeight: (compact ? 6.6 : 9.9) + 'em', overflow: 'hidden' } : {}),
        }}
        ref={body}
        id={id}
        className={!expanded ? 'expandable-text__body is-collapsed' : 'expandable-text__body'}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          className="text-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Свернуть описание' : 'Показать полностью'}
        </button>
      )}
    </div>
  )
}
