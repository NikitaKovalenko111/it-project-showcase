import { useState } from 'react'
import type { User } from '../types/models'
import {
  saveRepresentativeProfile,
  type RepresentativeProfile,
} from '../utils/representativeProfile'

export function RepresentativeProfileEditor({
  user,
  profile,
  onSaved,
}: {
  user: User
  profile?: RepresentativeProfile
  onSaved: (profile: RepresentativeProfile) => void
}) {
  const [draft, setDraft] = useState<typeof profile>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  return (
    <section className="representative-profile">
      <div className="representative-profile__header">
        <h2>О себе</h2>
        {!draft && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setMessage('')
              setError('')
              setDraft(
                profile || {
                  name: user.fullName,
                  position: user.companyProfile?.position || '',
                  bio: '',
                  expertise: '',
                },
              )
            }}
          >
            Редактировать профиль
          </button>
        )}
      </div>
      <p className="form-hint">
        Сведения доступны в этом браузере, в том числе во вкладке «Наставники и менторы».
      </p>
      {draft ? (
        <form
          className="representative-profile__form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!draft.name.trim() || !draft.bio.trim()) {
              setError('Укажите имя и расскажите о себе.')
              return
            }
            try {
              onSaved(saveRepresentativeProfile(user.id, draft))
              setDraft(undefined)
              setMessage('Профиль сохранён.')
              setError('')
            } catch {
              setError('Не удалось сохранить сведения в этом браузере.')
            }
          }}
        >
          <label className="form-group">
            Имя для отображения
            <input
              className="input"
              value={draft.name}
              maxLength={150}
              required
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="form-group">
            Должность
            <input
              className="input"
              value={draft.position}
              maxLength={150}
              onChange={(event) => setDraft({ ...draft, position: event.target.value })}
            />
          </label>
          <label className="form-group">
            Опыт и интересы
            <textarea
              className="textarea"
              rows={4}
              value={draft.bio}
              maxLength={2000}
              required
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
            />
          </label>
          <label className="form-group">
            Темы, с которыми могу помочь
            <input
              className="input"
              value={draft.expertise}
              maxLength={300}
              placeholder="Например, тестирование и системный анализ"
              onChange={(event) => setDraft({ ...draft, expertise: event.target.value })}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="action-row">
            <button className="btn btn-primary">Сохранить</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(undefined)}>
              Отмена
            </button>
          </div>
        </form>
      ) : profile?.bio ? (
        <div className="representative-profile__details">
          {profile.position && (
            <p className="representative-profile__position">{profile.position}</p>
          )}
          <p className="preserve-text">{profile.bio}</p>
          {profile.expertise && (
            <p className="mentorship-topics">
              <strong>Темы наставничества</strong>
              <span>{profile.expertise}</span>
            </p>
          )}
        </div>
      ) : (
        <p>Добавьте должность, опыт и темы, по которым можете помогать студентам.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
