import { useState } from 'react'
import type { RepresentativeDetails, User } from '../types/models'
import type { RepresentativeProfile } from '../utils/representativeProfile'

export function RepresentativeProfileEditor({
  user,
  profile,
  live,
  legacyProfile,
  onSave,
}: {
  user: User
  profile?: RepresentativeProfile
  live: boolean
  legacyProfile?: RepresentativeProfile
  onSave: (profile: RepresentativeProfile, changes: Partial<RepresentativeDetails>) => Promise<void>
}) {
  const [draft, setDraft] = useState<typeof profile>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const importable =
    legacyProfile &&
    ((!profile?.bio && legacyProfile.bio) || (!profile?.expertise && legacyProfile.expertise))

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
      {!live && <p className="form-hint">Сведения доступны в этом браузере.</p>}
      {draft ? (
        <form
          className="representative-profile__form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (busy) return
            if (!live && (!draft.name.trim() || !draft.bio.trim())) {
              setError('Укажите имя и расскажите о себе.')
              return
            }
            const changes: Partial<RepresentativeDetails> = {}
            if (draft.bio.trim() !== (profile?.bio ?? '')) changes.bio = draft.bio.trim()
            if (draft.expertise.trim() !== (profile?.expertise ?? ''))
              changes.expertise = draft.expertise.trim()
            setBusy(true)
            setError('')
            try {
              if (!live || Object.keys(changes).length) await onSave(draft, changes)
              setDraft(undefined)
              setMessage('Профиль сохранён.')
            } catch (cause) {
              setError((cause as Error).message || 'Не удалось сохранить профиль.')
            } finally {
              setBusy(false)
            }
          }}
        >
          {!live && (
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
          )}
          {!live && (
            <label className="form-group">
              Должность
              <input
                className="input"
                value={draft.position}
                maxLength={150}
                onChange={(event) => setDraft({ ...draft, position: event.target.value })}
              />
            </label>
          )}
          <label className="form-group">
            Опыт и интересы
            <textarea
              className="textarea"
              rows={4}
              value={draft.bio}
              maxLength={live ? 4000 : 2000}
              required={!live}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
            />
          </label>
          <label className="form-group">
            Темы, с которыми могу помочь
            <textarea
              className="textarea"
              rows={3}
              value={draft.expertise}
              maxLength={live ? 2000 : 300}
              disabled={busy}
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
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setDraft(undefined)}
            >
              Отмена
            </button>
            {importable && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  setDraft({
                    ...draft,
                    bio: draft.bio || legacyProfile.bio,
                    expertise: draft.expertise || legacyProfile.expertise,
                  })
                }
              >
                Подставить сведения из браузера
              </button>
            )}
          </div>
        </form>
      ) : profile && (profile.bio || profile.expertise) ? (
        <div className="representative-profile__details">
          {profile.position && (
            <p className="representative-profile__position">{profile.position}</p>
          )}
          {profile.bio && <p className="preserve-text">{profile.bio}</p>}
          {profile.expertise && (
            <p className="mentorship-topics">
              <strong>Темы наставничества</strong>
              <span className="preserve-text">{profile.expertise}</span>
            </p>
          )}
        </div>
      ) : (
        <p>Расскажите об опыте и темах, по которым можете помогать студентам.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
