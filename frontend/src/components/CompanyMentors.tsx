import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../types/models'
import {
  getCompanyMentors,
  getRepresentativeProfile,
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
  const profile = canParticipate && viewer ? getRepresentativeProfile(viewer.id) : undefined
  const included = mentors.some((mentor) => mentor.id === viewer?.id)

  useEffect(() => {
    const refresh = () => setMentors(getCompanyMentors(companyId))
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [companyId])

  return (
    <section className="company-mentors">
      <div className="company-mentors__header">
        <h2>Наставники и менторы</h2>
        {canParticipate && viewer && (included || (profile?.name && profile.bio)) && (
          <button
            className={`btn ${included ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => {
              setError('')
              setMessage('')
              try {
                setCompanyMentor(companyId, viewer.id, !included)
                setMentors(getCompanyMentors(companyId))
                setMessage(
                  included
                    ? 'Ваш профиль убран из списка.'
                    : 'Ваш профиль добавлен в список этого браузера.',
                )
              } catch {
                setError('Не удалось обновить список наставников в этом браузере.')
              }
            }}
          >
            {included ? 'Убрать себя из списка' : 'Добавить себя в наставники'}
          </button>
        )}
        {canParticipate && !included && !(profile?.name && profile.bio) && (
          <Link to="/account" className="btn btn-secondary">
            Заполнить мой профиль
          </Link>
        )}
      </div>
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
              <p className="preserve-text">{mentor.bio}</p>
              {mentor.expertise && (
                <p className="mentorship-topics">
                  <strong>Темы наставничества</strong>
                  <span>{mentor.expertise}</span>
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
