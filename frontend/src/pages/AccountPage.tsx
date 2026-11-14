import { ProfileAvatarUpload } from '../components/ProfileAvatarUpload'
import { useAppSelector } from '../store'

export function AccountPage() {
  const user = useAppSelector((state) => state.auth.currentUser)
  if (!user) return null
  return (
    <section className="card account-profile">
      <h1>Мой профиль</h1>
      <div className="account-profile__identity">
        <ProfileAvatarUpload user={user} />
        <div>
          <h2>{user.fullName}</h2>
          <p>{user.email}</p>
        </div>
      </div>
    </section>
  )
}
