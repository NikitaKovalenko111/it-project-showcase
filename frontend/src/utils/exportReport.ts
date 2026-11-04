import type { ReportTable } from './analytics'
import { reportToCsv } from './analytics'

export const downloadCsvReport = (tables: ReportTable[], name: string) => {
  const url = URL.createObjectURL(new Blob([reportToCsv(tables)], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadExcelReport = async (tables: ReportTable[], name: string) => {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  tables.forEach((table) => {
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows])
    sheet['!cols'] = table.headers.map((header, index) => ({ wch: Math.min(60, Math.max(header.length + 2, ...table.rows.map((row) => String(row[index] ?? '').length + 2))) }))
    XLSX.utils.book_append_sheet(workbook, sheet, table.title.slice(0, 31))
  })
  XLSX.writeFile(workbook, `${name}.xlsx`)
}

export const downloadPdfReport = async (tables: ReportTable[], name: string, title: string, filterDescription: string) => {
  const [{ jsPDF }, { default: autoTable }, fontResponse] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), fetch('/fonts/DejaVuSans.ttf'),
  ])
  if (!fontResponse.ok) throw new Error('Не удалось загрузить шрифт для PDF')
  const bytes = new Uint8Array(await fontResponse.arrayBuffer())
  let fontBinary = ''
  for (let start = 0; start < bytes.length; start += 8192) fontBinary += String.fromCharCode(...bytes.subarray(start, start + 8192))
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.addFileToVFS('DejaVuSans.ttf', btoa(fontBinary))
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal')
  doc.setFont('DejaVuSans')
  doc.setFontSize(16)
  doc.text(title, 14, 18)
  doc.setFontSize(9)
  const filterLines = doc.splitTextToSize(filterDescription, 265)
  doc.text(filterLines, 14, 26)
  let y = 30 + filterLines.length * 4
  tables.forEach((table, index) => {
    if (index > 0) { doc.addPage(); y = 20 }
    doc.setFontSize(12)
    doc.text(table.title, 14, y)
    autoTable(doc, {
      startY: y + 5, head: [table.headers], body: table.rows.length ? table.rows : [table.headers.map((_, index) => index === 0 ? 'Нет данных' : '')],
      styles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { font: 'DejaVuSans', fontStyle: 'normal', fillColor: [15, 43, 72] },
      margin: { left: 14, right: 14, bottom: 15 },
    })
  })
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8)
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 278, 202, { align: 'right' })
  }
  doc.save(`${name}.pdf`)
}
