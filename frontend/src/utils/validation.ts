export function isPhoneValid(value: string) {
  const phone = value.trim()
  return !phone || (/^\+?[0-9(). -]+$/.test(phone) && /^\d{7,15}$/.test(phone.replace(/\D/g, '')))
}

export function isOptionalWebUrl(value: string) {
  const text = value.trim()
  if (!text) return true
  if (!/^https?:\/\//i.test(text) || /\s/.test(text)) return false
  try {
    const url = new URL(text)
    return !!url.hostname && !url.username && !url.password
  } catch {
    return false
  }
}

export const TEAM_NAME_MAX_LENGTH = 80
