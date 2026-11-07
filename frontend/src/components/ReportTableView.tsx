import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function ReportTableView({ label, headers, rows, emptyText }: {
  label: string
  headers: string[]
  rows: { id: string | number; cells: ReactNode[] }[]
  emptyText: string
}) {
  const [page, setPage] = useState(1)
  const size = 10
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(page, pages)
  const start = (current - 1) * size
  if (!rows.length) return <p className="report-table-empty">{emptyText}</p>

  return <>
    <div className="table-container report-table-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className="data-table">
        <thead><tr>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.slice(start, start + size).map(row => <tr key={row.id}>
          {row.cells.map((cell, index) => <td key={index}>{cell}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {pages > 1 && <nav className="report-table-pager" aria-label={`Страницы: ${label}`}>
      <span aria-live="polite">{start + 1}–{Math.min(start + size, rows.length)} из {rows.length}</span>
      <button type="button" className="btn btn-secondary btn-sm" aria-label="Предыдущая страница" disabled={current===1} onClick={()=>setPage(current-1)}><ChevronLeft size={16}/></button>
      <button type="button" className="btn btn-secondary btn-sm" aria-label="Следующая страница" disabled={current===pages} onClick={()=>setPage(current+1)}><ChevronRight size={16}/></button>
    </nav>}
  </>
}
