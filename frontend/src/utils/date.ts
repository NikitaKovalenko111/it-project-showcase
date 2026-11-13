export function formatDate(value?: string | null): string {
  if (!value) return 'Не указан'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Не указан' : date.toLocaleDateString('ru-RU')
}

export function localDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// Date-only values include the whole calendar day in the showcase's timezone.
export function isPastDeadline(value: string, now = new Date()) {
  if (!value) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(value) < now.getTime()
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Yekaterinburg' }).format(now)
  return value < today
}
