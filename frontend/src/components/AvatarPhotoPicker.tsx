import { Camera } from 'lucide-react'
import { useState, type ComponentProps, type PropsWithChildren } from 'react'
import { AvatarCropModal } from './AvatarCropModal'

type CropOptions = Pick<
  ComponentProps<typeof AvatarCropModal>,
  'title' | 'instructions' | 'notice' | 'saveLabel' | 'initialZoom'
>

const imageTypes = ['image/png', 'image/jpeg', 'image/webp']

export function AvatarPhotoPicker({
  children,
  label,
  onSave,
  cropOptions,
}: PropsWithChildren<{
  label: string
  onSave: (file: File) => Promise<void>
  cropOptions?: CropOptions
}>) {
  const [selected, setSelected] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="profile-avatar-control">
      <div className="profile-avatar-picture">
        {children}
        <label className="profile-avatar-picker" title={label}>
          <Camera size={16} aria-hidden="true" />
          <input
            type="file"
            aria-label={label}
            accept={imageTypes.join(',')}
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!file || busy) return
              setError('')
              if (!file.size || !imageTypes.includes(file.type)) {
                setError('Выберите непустое изображение в формате JPG, PNG или WebP.')
                return
              }
              setSelected(file)
            }}
          />
        </label>
      </div>
      {selected && (
        <AvatarCropModal
          key={selected.name + selected.lastModified}
          {...cropOptions}
          file={selected}
          onClose={() => setSelected(undefined)}
          onSave={async (file) => {
            setBusy(true)
            try {
              await onSave(file)
              setSelected(undefined)
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {busy && <small role="status">Загрузка…</small>}
      {error && <small role="alert">{error}</small>}
    </div>
  )
}
