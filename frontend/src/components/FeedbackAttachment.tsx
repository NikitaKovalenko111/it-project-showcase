import { AttachmentPreview } from './AttachmentPreview'
import { useEffect, useState } from 'react'
import { axiosInstance } from '../api/http'

const rasterTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type Preview = { name: string; type: string; url?: string; text?: string }

export function FeedbackAttachment({ name, path }: { name: string; path: string }) {
  const [preview, setPreview] = useState<Preview>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let url: string | undefined
    axiosInstance
      .get<Blob>(path, { responseType: 'blob', signal: controller.signal })
      .then(async ({ data, headers }) => {
        if (controller.signal.aborted) return
        const match = String(headers['content-disposition'] || '').match(
          /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i,
        )
        let filename = name
        if (match?.[1]) {
          try {
            filename = decodeURIComponent(match[1])
          } catch {
            /* Keep the fallback. */
          }
        } else if (match?.[2]) filename = match[2]
        const type = data.type.split(';')[0].toLowerCase()
        url = URL.createObjectURL(data)
        const text = type === 'text/plain' ? await data.slice(0, 8192).text() : undefined
        if (!controller.signal.aborted) setPreview({ name: filename, type, url, text })
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [name, path])

  if (failed) return <small>{name} · Предпросмотр недоступен</small>
  if (!preview) return <small role="status">{name} · Загружается</small>
  return (
    <div className="feedback-attachment">
      {preview.url && (
        <AttachmentPreview
          file={{ name: preview.name, url: preview.url }}
          image={rasterTypes.includes(preview.type)}
        />
      )}
      {preview.text !== undefined && <pre>{preview.text}</pre>}
    </div>
  )
}
