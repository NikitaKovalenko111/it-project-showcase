import { LocalizedFileInput } from './LocalizedFileInput'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { uploadFile } from '../utils/files'
import type { OpportunityKind } from './modals/OpportunityPublicationModal'
import { Link } from 'react-router-dom'
import { opportunityApi, type OpportunityApplication } from '../api/opportunities'
import { apiClient } from '../api/client'
import type { StudentProfile } from '../types/models'
import { FileDownload } from './FileDownload'
import { ReportTableView } from './ReportTableView'

const statuses = {
  submitted: 'На рассмотрении',
  accepted: 'Принята',
  rejected: 'Отклонена',
  withdrawn: 'Отозвана',
}

export function InternshipApply({
  programId,
  title,
  kind,
  onApplied,
}: {
  programId: string
  title: string
  kind: OpportunityKind
  onApplied: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [letter, setLetter] = useState('')
  const [resume, setResume] = useState<StudentProfile['resume']>()
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachResume, setAttachResume] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resumeError, setResumeError] = useState(false)
  const label = kind === 'practice' ? 'Заявка на практику' : 'Заявка на стажировку'

  const open = async () => {
    setError('')
    setResumeError(false)
    dialog.current?.showModal()
    try {
      setResume(await apiClient.getResume())
    } catch {
      setResumeError(true)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={open}>
        Подать заявку
      </button>
      <dialog
        ref={dialog}
        className="modal-dialog opportunity-apply-dialog"
        aria-labelledby="opportunity-apply-title"
        onCancel={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <header className="modal-dialog__header">
          <div>
            <h3 id="opportunity-apply-title">{label}</h3>
            <p>{title}</p>
          </div>
          <button
            type="button"
            className="close-btn"
            aria-label="Закрыть"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (busy) return
            setBusy(true)
            setError('')
            try {
              const uploaded = attachment
                ? await uploadFile(attachment)
                : attachResume
                  ? resume
                  : undefined
              await opportunityApi.apply(programId, letter.trim(), uploaded?.file_id, uploaded?.url)
              dialog.current?.close()
              onApplied()
            } catch (cause) {
              const failure = cause as Error & { status?: number }
              setError(
                failure.status === 409
                  ? 'У вас уже есть заявка на эту программу.'
                  : failure.status === 403
                    ? 'Приём заявок закрыт или все места заняты.'
                    : failure.message,
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          <div className="modal-dialog__body">
            <label>
              Сопроводительное письмо
              <textarea
                className="textarea"
                rows={5}
                maxLength={4000}
                disabled={busy}
                placeholder="Кратко расскажите о себе и почему вам интересна программа"
                value={letter}
                onChange={(event) => setLetter(event.target.value)}
              />
            </label>
            {resume?.url && (
              <label className="opportunity-resume-option">
                <input
                  type="checkbox"
                  checked={attachResume}
                  disabled={busy || !!attachment}
                  onChange={(event) => setAttachResume(event.target.checked)}
                />
                Приложить резюме из профиля · {resume.name}
              </label>
            )}
            {resumeError && (
              <small>Резюме из профиля не загрузилось. Можно приложить файл ниже.</small>
            )}
            <label>
              Приложить файл резюме (необязательно)
              <LocalizedFileInput
                className="input"
                accept=".pdf,.doc,.docx"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file && (file.size > 2 * 1024 * 1024 || !/\.(pdf|docx?)$/i.test(file.name))) {
                    setAttachment(null)
                    event.target.value = ''
                    setError('Выберите PDF, DOC или DOCX размером до 2 МБ.')
                    return
                  }
                  setError('')
                  setAttachment(file || null)
                  if (file) setAttachResume(false)
                }}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </div>
          <footer className="modal-dialog__footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Отмена
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Отправляем…' : 'Отправить заявку'}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  )
}

export function InternshipApplications({ programId }: { programId?: string }) {
  const [items, setItems] = useState<OpportunityApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    opportunityApi
      .listApplications(programId)
      .then((rows) => {
        if (active) setItems(rows)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [programId])

  const decide = async (id: string, status: 'accepted' | 'rejected' | 'withdrawn') => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const data = await opportunityApi.decide(id, status)
      setItems((rows) => rows.map((row) => (row.application_id === id ? { ...row, ...data } : row)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h3>{programId ? 'Заявки студентов' : 'Мои заявки на стажировки и практики'}</h3>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Загрузка заявок…</p>
      ) : (
        <ReportTableView
          label="Заявки на стажировки и практики"
          headers={[
            programId ? 'Студент' : 'Программа',
            'Дата',
            'Статус',
            'Письмо и резюме',
            'Действия',
          ]}
          rows={items.map((item) => ({
            id: item.application_id,
            cells: [
              programId ? (
                <Link to={`/profile/${item.student_id}`}>
                  {item.student_name || 'Открыть профиль'}
                </Link>
              ) : (
                <>
                  <strong>{item.program_title || 'Программа'}</strong>
                  <br />
                  <small>{item.program_kind === 'practice' ? 'Практика' : 'Стажировка'}</small>
                </>
              ),
              new Date(item.created_at).toLocaleDateString('ru-RU'),
              statuses[item.status],
              <>
                {item.cover_letter && <p className="preserve-text">{item.cover_letter}</p>}
                {(item.resume_file_id || item.resume_url) && !programId && (
                  <small>Резюме приложено</small>
                )}
                {(item.resume_file_id || item.resume_url) && programId && (
                  <FileDownload
                    file={{
                      name: 'Скачать резюме',
                      url:
                        item.resume_url ||
                        `/api/v1/internships/applications/${item.application_id}/resume`,
                    }}
                  />
                )}
              </>,
              item.status === 'submitted' && (
                <div className="action-row">
                  {programId ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => decide(item.application_id, 'accepted')}
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => decide(item.application_id, 'rejected')}
                      >
                        Отклонить
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => decide(item.application_id, 'withdrawn')}
                    >
                      Отозвать
                    </button>
                  )}
                </div>
              ),
            ],
          }))}
          emptyText="Заявок пока нет."
        />
      )}
    </section>
  )
}
