import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { axiosInstance } from '../api/http'
import { apiRuntime } from '../api/runtime'

export function useImageUrl(src?: string) {
  const base = (apiRuntime.baseUrl || '/api/v1').replace(/\/$/, '')
  const protectedUrl = apiRuntime.mode === 'live' && !!src?.startsWith(base + '/')
  const [image, setImage] = useState<{ source?: string; url?: string; failed?: boolean }>({})
  useEffect(() => {
    if (!protectedUrl || !src) return
    let active = true
    let objectUrl: string | undefined
    axiosInstance
      .get(src.slice(base.length), { responseType: 'blob' })
      .then(({ data }) => {
        if (active) {
          objectUrl = URL.createObjectURL(data)
          setImage({ source: src, url: objectUrl })
        }
      })
      .catch(() => {
        if (active) setImage({ source: src, failed: true })
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, base, protectedUrl])
  return protectedUrl ? (image.source === src ? image : { source: src }) : { source: src, url: src }
}

export function ApiImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const image = useImageUrl(src)
  const [failed, setFailed] = useState<string>()
  if (image.failed || (src && failed === src))
    return <span className="image-unavailable">{alt || 'Изображение недоступно'}</span>
  if (!image.url)
    return (
      <span className="image-loading" role="status">
        Загрузка изображения…
      </span>
    )
  return <img {...props} src={image.url} alt={alt || ''} onError={() => setFailed(src)} />
}
