const utf8 = new TextEncoder()

export function shorteningError(
  label: string,
  value: string,
  limit: number,
  unit: 'characters' | 'utf8' = 'characters',
) {
  const text = value.trim()
  let maxCharacters = limit
  if (unit === 'utf8') {
    const { read } = utf8.encodeInto(text, new Uint8Array(limit))
    if (read === text.length) return ''
    // The API measures UTF-8 bytes for internships. A Unicode prefix gives the
    // number of characters from the current text that fits within that budget.
    maxCharacters = Array.from(text.slice(0, read)).length
  } else if (text.length <= limit || Array.from(text).length <= limit) {
    return ''
  }
  return `Сократите ${label} до ${maxCharacters.toLocaleString('ru-RU')} символов.`
}
