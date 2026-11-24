import { ProfileAvatarUpload } from '../components/ProfileAvatarUpload'
import { RepresentativeProfileEditor } from '../components/RepresentativeProfileEditor'
import { store, useAppDispatch, useAppSelector } from '../store'
import { useEffect, useState } from 'react'
import type { RepresentativeDetails, User } from '../types/models'
import { getRepresentativeProfile, saveRepresentativeProfile } from '../utils/representativeProfile'
import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { fetchCurrentUserSuccess } from '../store/actions'

export function AccountPage() {
  const user = useAppSelector((state) => state.auth.currentUser)
  return user ? <AccountProfile key={user.id} user={user} /> : null
}

function AccountProfile({ user }: { user: User }) {
  const liveRepresentative = apiRuntime.mode === 'live' && user.role === 'company'
  const dispatch = useAppDispatch()
  const [localProfile, setLocalProfile] = useState(() =>
    user.role === 'company' ? getRepresentativeProfile(user.id) : undefined,
  )
  const [loading, setLoading] = useState(liveRepresentative)
  const [loadError, setLoadError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const userId = user.id
  const remember = (details: RepresentativeDetails) => {
    const current = store.getState().auth.currentUser
    if (current?.id === userId)
      dispatch(fetchCurrentUserSuccess({ ...current, representativeDetails: details }))
  }
  useEffect(() => {
    if (!liveRepresentative) return
    let active = true
    setLoading(true)
    setLoadError('')
    apiClient
      .getRepresentativeProfile()
      .then((profile) => {
        if (active) remember(profile)
      })
      .catch((cause: Error) => {
        if (active) setLoadError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [liveRepresentative, userId, loadVersion])
  const profile = liveRepresentative
    ? { name: user.fullName, position: '', bio: '', expertise: '', ...user.representativeDetails }
    : localProfile
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
      {user.role === 'company' &&
        (loading ? (
          <p role="status">Загружаем профиль…</p>
        ) : loadError ? (
          <div className="representative-profile">
            <p className="form-error" role="alert">
              {loadError}
            </p>
            <div>
              <button
                className="btn btn-secondary"
                onClick={() => setLoadVersion((version) => version + 1)}
              >
                Повторить загрузку
              </button>
            </div>
          </div>
        ) : (
          <RepresentativeProfileEditor
            user={user}
            profile={profile}
            live={liveRepresentative}
            legacyProfile={liveRepresentative ? localProfile : undefined}
            onSave={async (draft, changes) => {
              if (liveRepresentative) remember(await apiClient.updateRepresentativeProfile(changes))
              else setLocalProfile(saveRepresentativeProfile(userId, draft))
            }}
          />
        ))}
    </section>
  )
}
