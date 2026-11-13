import { useState } from 'react'
import { AvatarCropModal } from './AvatarCropModal'
import { Camera } from 'lucide-react'
import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { useAppDispatch } from '../store'
import { fetchCurrentUserSuccess } from '../store/actions'
import type { User } from '../types/models'
import { IdentityImage } from './IdentityImage'

export function ProfileAvatarUpload({ user }: { user: User }) {
  const dispatch = useAppDispatch()
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<File>()
  const [error, setError] = useState('')
  const live = apiRuntime.mode === 'live'
  const limit = live ? 2 : 1
  const canUpload = !live || user.role === 'student'
  return (
    <div className="profile-avatar-control">
      <div className="profile-avatar-picture">
        <IdentityImage src={user.avatar} name={user.fullName} className="profile-avatar" />
        {canUpload && (
          <label className="profile-avatar-picker" title="Изменить аватар">
            <Camera size={16} aria-hidden="true" />
            <input
              type="file"
              aria-label="Изменить аватар"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (!file || busy) return
                setError('')
                if (
                  !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
                  file.size > limit * 1024 * 1024
                ) {
                  setError(`Выберите JPG, PNG или WebP до ${limit} МБ.`)
                  return
                }
                setSelected(file)
              }}
            />
          </label>
        )}
      </div>
      {!canUpload && <small>Загрузка аватара доступна в профиле студента.</small>}
      {selected && (
        <AvatarCropModal
          key={selected.name + selected.lastModified}
          file={selected}
          onClose={() => setSelected(undefined)}
          onSave={async (cropped) => {
            setBusy(true)
            try {
              const updated = await apiClient.updateAvatar(user, cropped)
              dispatch(fetchCurrentUserSuccess(updated))
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
