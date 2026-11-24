import { useState } from 'react'
import { AvatarCropModal } from './AvatarCropModal'
import { Camera } from 'lucide-react'
import { apiClient } from '../api/client'
import { useAppDispatch } from '../store'
import { fetchCurrentUserSuccess } from '../store/actions'
import type { User } from '../types/models'
import { UserAvatar } from './UserAvatar'

export function ProfileAvatarUpload({ user }: { user: User }) {
  const dispatch = useAppDispatch()
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<File>()
  const [error, setError] = useState('')
  return (
    <div className="profile-avatar-control">
      <div className="profile-avatar-picture">
        <UserAvatar
          userId={user.id}
          src={user.avatar}
          name={user.fullName}
          className="profile-avatar"
        />
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
              if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                setError('Выберите JPG, PNG или WebP.')
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
