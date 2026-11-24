import { ProfileAvatarUpload } from '../components/ProfileAvatarUpload'
import { RepresentativeProfileEditor } from '../components/RepresentativeProfileEditor'
import { useAppSelector } from '../store'
import { useState } from 'react'
import type { User } from '../types/models'
import { getRepresentativeProfile } from '../utils/representativeProfile'

export function AccountPage() {
  const user = useAppSelector((state) => state.auth.currentUser)
  return user ? <AccountProfile key={user.id} user={user} /> : null
}

function AccountProfile({ user }: { user: User }) {
  const [profile, setProfile] = useState(() =>
    user.role === 'company' ? getRepresentativeProfile(user.id) : undefined,
  )
  return (
    <section className="card account-profile">
      <h1>Мой профиль</h1>
      <div className="account-profile__identity">
        <ProfileAvatarUpload user={user} />
        <div>
          <h2>{profile?.name || user.fullName}</h2>
          <p>{user.email}</p>
        </div>
      </div>
      {user.role === 'company' && (
        <RepresentativeProfileEditor user={user} profile={profile} onSaved={setProfile} />
      )}
    </section>
  )
}
