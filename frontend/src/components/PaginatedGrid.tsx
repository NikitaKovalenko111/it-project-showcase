import React from 'react'
import { useSearchParams } from 'react-router-dom'
export const PaginatedGrid: React.FC<
  React.PropsWithChildren<{ className?: string; pageSize?: number; style?: React.CSSProperties }>
> = ({ children, className = 'case-grid', pageSize = 10, style }) => {
  const [params, setParams] = useSearchParams()
  const items = React.Children.toArray(children)
  const requestedSize = Number(params.get('pageSize'))
  const size = [5, 10, 50, 100].includes(requestedSize) ? requestedSize : pageSize
  const requestedPage = Number(params.get('page'))
  const pages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pages,
  )
  const change = (page: number, count = size) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('page', String(page))
        next.set('pageSize', String(count))
        return next
      },
      { replace: true },
    )
  const numbers = Array.from(new Set([1, current - 1, current, current + 1, pages]))
    .filter((n) => n > 0 && n <= pages)
    .sort((a, b) => a - b)
  return (
    <>
      <div className={className} style={style}>
        {items.slice((current - 1) * size, current * size)}
      </div>
      {items.length > 0 && (
        <nav className="pagination" aria-label="Страницы списка">
          <div className="pagination__pages">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label="Предыдущая страница"
              disabled={current === 1}
              onClick={() => change(current - 1)}
            >
              ←
            </button>
            {numbers.map((n, i) => (
              <React.Fragment key={n}>
                {i > 0 && n > numbers[i - 1] + 1 && <span>…</span>}
                <button
                  type="button"
                  className={`btn btn-sm ${n === current ? 'btn-primary' : 'btn-secondary'}`}
                  aria-current={n === current ? 'page' : undefined}
                  onClick={() => change(n)}
                >
                  {n}
                </button>
              </React.Fragment>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label="Следующая страница"
              disabled={current === pages}
              onClick={() => change(current + 1)}
            >
              →
            </button>
          </div>
          <label className="pagination__size">
            На странице{' '}
            <select
              className="select"
              value={size}
              onChange={(e) => change(1, Number(e.target.value))}
            >
              {Array.from(new Set([pageSize, 5, 10, 50, 100]))
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n}>{n}</option>
                ))}
            </select>
          </label>
        </nav>
      )}
    </>
  )
}
