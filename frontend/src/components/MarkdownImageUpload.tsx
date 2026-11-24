import { useState } from 'react'
import { LocalizedFileInput } from './LocalizedFileInput'
import { uploadFile } from '../utils/files'
export function markdownImageLink(name: string, url: string) {
  return `\n\n![${name.replace(/[\[\]\\\r\n]/g, '')}](${url})\n`
}

export function MarkdownImageUpload(
  props: { onInsert: (markdown: string) => void } | { onUpload: (file: File) => Promise<void> },
) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  return (
    <div className="markdown-image-upload">
      <label>
        Добавить фото в текст
        <LocalizedFileInput
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
              setError('Выберите PNG, JPG, WebP или GIF.')
              return
            }
            setBusy(true)
            setError('')
            try {
              if ('onUpload' in props) await props.onUpload(file)
              else {
                const uploaded = await uploadFile(file)
                props.onInsert(markdownImageLink(file.name, uploaded.url))
              }
            } catch (cause) {
              setError((cause as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
