import React, { useEffect, useState } from 'react'
export const PaginatedGrid: React.FC<React.PropsWithChildren<{ className?: string; pageSize?: number; style?: React.CSSProperties }>> = ({children, className = 'case-grid', pageSize = 6, style}) => {
  const items = React.Children.toArray(children)
  const signature = items.map(c => React.isValidElement(c) ? c.key : '').join('|')
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pages)
  useEffect(() => setPage(1), [signature, pageSize])
  return <><div className={className} style={style}>{items.slice((current - 1) * pageSize, current * pageSize)}</div>{items.length > 0 && <nav className="pagination" aria-label="Страницы списка"><button className="btn btn-secondary btn-sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Назад</button><span aria-live="polite">{current} из {pages}</span><button className="btn btn-secondary btn-sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Далее</button></nav>}</>
}
