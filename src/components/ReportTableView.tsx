import { useState, type ReactNode } from 'react'
import { PaginationControls } from './PaginatedGrid'

export function useTablePagination<T>(rows: T[], label: string, filter = '') {
  const [selection, setSelection] = useState({ page: 1, filter })
  const [size, setSize] = useState(10)
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(selection.filter === filter ? selection.page : 1, pages)
  const start = (current - 1) * size
  return {
    items: rows.slice(start, start + size),
    controls: rows.length > 0 && (
      <PaginationControls
        current={current}
        pages={pages}
        size={size}
        label={`Страницы списка «${label}»`}
        change={(page, nextSize) => {
          setSelection({ page, filter })
          if (nextSize !== undefined) setSize(nextSize)
        }}
      />
    ),
  }
}

export function ReportTableView({
  label,
  headers,
  rows,
  emptyText,
}: {
  label: string
  headers: string[]
  rows: { id: string | number; cells: ReactNode[] }[]
  emptyText: string
}) {
  const { items, controls } = useTablePagination(rows, label)
  if (!rows.length) return <p className="report-table-empty">{emptyText}</p>

  return (
    <>
      <div
        className="table-container report-table-scroll report-table-responsive"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th scope="col" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td key={index} data-label={headers[index]}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {controls}
    </>
  )
}
