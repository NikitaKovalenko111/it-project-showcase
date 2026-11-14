import { useState } from 'react'
import { LocalizedFileInput } from './LocalizedFileInput'
import { uploadFile } from '../utils/files'
export function MarkdownImageUpload({ onInsert }: { onInsert: (markdown: string) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  return (
    <div className="markdown-image-upload">
      <label>
        Добавить фото в текст
        <LocalizedFileInput
          accept="image/png,image/jpeg,image/webp,image/gif"
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
              const uploaded = await uploadFile(file)
              onInsert('\n\n![' + file.name.replace(/[\[\]]/g, '') + '](' + uploaded.url + ')\n')
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
