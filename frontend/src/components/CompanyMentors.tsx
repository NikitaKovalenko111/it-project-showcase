import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRuntime } from '../api/runtime'
import type { User } from '../types/models'
import {
  getCompanyMentors,
  getRepresentativeProfile,
  saveRepresentativeProfile,
  setCompanyMentor,
} from '../utils/representativeProfile'
import { UserAvatar } from './UserAvatar'

export function CompanyMentors({
  companyId,
  viewer,
  canParticipate,
}: {
  companyId: string
  viewer: User | null
  canParticipate: boolean
}) {
  const [mentors, setMentors] = useState(() => getCompanyMentors(companyId))
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const live = apiRuntime.mode === 'live'
  const profile =
    canParticipate && viewer
      ? live
        ? {
            name: viewer.fullName,
            position: '',
            bio: '',
            expertise: '',
            ...viewer.representativeDetails,
          }
        : getRepresentativeProfile(viewer.id)
      : undefined
  const entry = mentors.find((mentor) => mentor.id === viewer?.id)
  const hasDetails = !!(profile?.name && (profile.bio || profile.expertise))
  const canUpdate = !!(
    live &&
    entry &&
    profile &&
    hasDetails &&
    (entry.name !== profile.name ||
      entry.bio !== profile.bio ||
      entry.expertise !== profile.expertise)
  )

  const changeMentor = (action: 'add' | 'remove' | 'update') => {
    if (!viewer) return
    setError('')
    setMessage('')
    try {
      if (live && profile && action !== 'remove') saveRepresentativeProfile(viewer.id, profile)
      setCompanyMentor(companyId, viewer.id, action !== 'remove')
      setMentors(getCompanyMentors(companyId))
      setMessage(
        {
          add: 'Ваш профиль добавлен в список этого браузера.',
          remove: 'Ваш профиль убран из списка.',
          update: 'Карточка наставника обновлена.',
        }[action],
      )
    } catch {
      setError('Не удалось обновить список наставников в этом браузере.')
    }
  }

  useEffect(() => {
    const refresh = () => setMentors(getCompanyMentors(companyId))
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [companyId])

  return (
    <section className="company-mentors">
      <div className="company-mentors__header">
        <h2>Наставники и менторы</h2>
        {canParticipate && (entry || hasDetails) && (
          <button
            className={`btn ${entry ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => changeMentor(entry ? 'remove' : 'add')}
          >
            {entry ? 'Убрать себя из списка' : 'Добавить себя в наставники'}
          </button>
        )}
        {canParticipate && !entry && !hasDetails && (
          <Link to="/account" className="btn btn-secondary">
            Заполнить мой профиль
          </Link>
        )}
      </div>
      {canUpdate && (
        <div>
          <button className="btn btn-secondary" onClick={() => changeMentor('update')}>
            Обновить карточку из профиля
          </button>
        </div>
      )}
      {(canParticipate || mentors.length > 0) && (
        <p className="form-hint">Этот список доступен только в текущем браузере.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {mentors.length ? (
        <div className="company-mentors__list">
          {mentors.map((mentor) => (
            <article className="card company-mentors__card" key={mentor.id}>
              <div className="company-mentors__identity">
                <UserAvatar
                  userId={mentor.id}
                  src={mentor.id === viewer?.id ? viewer.avatar : undefined}
                  name={mentor.name}
                  className="company-mentors__avatar"
                />
                <div>
                  <h3>{mentor.name}</h3>
                  {mentor.position && <p>{mentor.position}</p>}
                </div>
              </div>
              {mentor.bio && <p className="preserve-text">{mentor.bio}</p>}
              {mentor.expertise && (
                <p className="mentorship-topics">
                  <strong>Темы наставничества</strong>
                  <span className="preserve-text">{mentor.expertise}</span>
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">Наставники пока не добавлены.</p>
      )}
    </section>
  )
}
