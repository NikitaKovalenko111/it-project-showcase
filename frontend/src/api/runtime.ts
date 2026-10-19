export const TOKEN_STORAGE_KEY = 'uust_auth_token'
export const CURRENT_USER_KEY = 'uust_current_user'

export const apiRuntime = {
  mode: (import.meta.env.VITE_API_MODE as string) || 'mock',
  baseUrl: (import.meta.env.VITE_API_URL as string) || '',
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 15000,
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_STORAGE_KEY),
}
