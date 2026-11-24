import { useEffect, useState } from 'react'
import { axiosInstance } from '../api/http'

export function useProtectedImage(path?: string, viewerId?: string) {
  const [image, setImage] = useState<{ path: string; viewerId: string; url: string }>()

  useEffect(() => {
    if (!path || !viewerId) return
    const controller = new AbortController()
    let url: string | undefined
    void axiosInstance
      .get<Blob>(path, { responseType: 'blob', signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(data)
        setImage({ path, viewerId, url })
      })
      .catch(() => undefined)
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [path, viewerId])

  return path && viewerId && image?.path === path && image.viewerId === viewerId
    ? image.url
    : undefined
}
