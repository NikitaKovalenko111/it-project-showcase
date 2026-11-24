import { apiClient } from '../api/client'
import { useAppDispatch } from '../store'
import { fetchCurrentUserSuccess } from '../store/actions'
import type { User } from '../types/models'
import { AvatarPhotoPicker } from './AvatarPhotoPicker'
import { UserAvatar } from './UserAvatar'

export function ProfileAvatarUpload({ user }: { user: User }) {
  const dispatch = useAppDispatch()
  return (
    <AvatarPhotoPicker
      label="Изменить аватар"
      onSave={async (file) => {
        dispatch(fetchCurrentUserSuccess(await apiClient.updateAvatar(user, file)))
      }}
    >
      <UserAvatar
        userId={user.id}
        src={user.avatar}
        name={user.fullName}
        className="profile-avatar"
      />
    </AvatarPhotoPicker>
  )
}
