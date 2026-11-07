import { createHttpClient } from './httpClient'
import { apiRuntime, tokenStore } from './runtime'
export const axiosInstance = createHttpClient({
  baseURL: apiRuntime.baseUrl || '/api/v1',
  timeoutMs: apiRuntime.timeoutMs,
  tokenStore,
  getRefreshToken: () => localStorage.getItem('uust_refresh_token'),
  saveRefreshToken: (token) => localStorage.setItem('uust_refresh_token', token),
  onUnauthorized: () => window.dispatchEvent(new Event('uust:unauthorized')),
})
