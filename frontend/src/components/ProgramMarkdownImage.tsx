import { ApiImage } from './ApiImage'
import { apiRuntime } from '../api/runtime'
import { programFilesUrl } from '../api/opportunities'

export function ProgramMarkdownImage({
  src,
  alt,
  programId,
  authenticated,
}: {
  src?: string
  alt?: string
  programId?: string
  authenticated: boolean
}) {
  if (!src) return <span>{alt || 'Изображение недоступно'}</span>
  if (
    apiRuntime.mode === 'live' &&
    authenticated &&
    programId &&
    URL.canParse(src, window.location.origin)
  ) {
    const prefix = programFilesUrl(programId)
    const prefixUrl = new URL(prefix, window.location.origin)
    const image = new URL(src, window.location.origin)
    const filePath = image.pathname.slice(prefixUrl.pathname.length)
    if (
      image.origin === prefixUrl.origin &&
      image.pathname.startsWith(prefixUrl.pathname) &&
      /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\/content$/i.test(filePath)
    ) {
      return <ApiImage src={prefix + filePath} alt={alt} loading="lazy" />
    }
    const legacyPrefix = (apiRuntime.baseUrl || '/api/v1').replace(/\/+$/, '') + '/files/'
    const legacyUrl = new URL(legacyPrefix, window.location.origin)
    const legacyId = image.pathname.slice(legacyUrl.pathname.length)
    if (
      image.origin === legacyUrl.origin &&
      image.pathname.startsWith(legacyUrl.pathname) &&
      /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(legacyId)
    ) {
      return <ApiImage src={legacyPrefix + legacyId} alt={alt} loading="lazy" />
    }
  }
  return <img src={src} alt={alt || ''} loading="lazy" />
}
