import { createId } from '../utils/id'
import { FileDownload } from '../components/FileDownload'
import React, { useEffect, useState } from 'react'
import { FilePicker } from '../components/FilePicker'
import { useAppSelector } from '../store'
import { axiosInstance } from '../api/http'
import { apiRuntime } from '../api/runtime'
import { collectNumbered } from '../api/backend'
import { uploadFile } from '../utils/files'
import { AdminInsights } from '../components/AdminInsights'
import { FeedbackAttachment } from '../components/FeedbackAttachment'
import { ReportTableView } from '../components/ReportTableView'

type Feedback = {
  feedback_id: string
  body: string
  file_ids: string[]
  created_at: string
  status: 'reviewing' | 'accepted' | 'rejected'
  userId?: string
  mockFiles?: { name: string; url: string }[]
}
const labels = { reviewing: 'На рассмотрении', accepted: 'Принято', rejected: 'Отклонено' }
const mockFeedbackKey = 'showcase_curated_v1_feedback'
const readMockFeedback = (): Feedback[] => JSON.parse(localStorage.getItem(mockFeedbackKey) || '[]')
const saveMockFeedback = (records: Feedback[]) =>
  localStorage.setItem(mockFeedbackKey, JSON.stringify(records))
const fileDrafts = new Map<string, File[]>()
export const FeedbackPage: React.FC = () => {
  const user = useAppSelector((s) => s.auth.currentUser)
  const userId = user?.id || 'guest'
  const live = apiRuntime.mode === 'live'
  const admin = user?.role === 'admin'
  const key = `feedback-draft:${userId}`
  const [text, setText] = useState(() => sessionStorage.getItem(key) || ''),
    [files, setFiles] = useState<File[]>(() => fileDrafts.get(key) || []),
    [error, setError] = useState('')
  const [records, setRecords] = useState<Feedback[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    if (live)
      collectNumbered<Feedback>((params) =>
        axiosInstance.get(admin ? '/feedback' : '/feedback/mine', { params }),
      )
        .then((rows) => {
          if (active) setRecords(rows)
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    else setRecords(readMockFeedback().filter((item) => admin || item.userId === userId))
    return () => {
      active = false
    }
  }, [admin, userId, live])
  useEffect(() => {
    setText(sessionStorage.getItem(key) || '')
    setFiles(fileDrafts.get(key) || [])
    setError('')
  }, [key])
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([])
  useEffect(() => {
    const next = files
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))
    setPreviews(next)
    return () => next.forEach((p) => URL.revokeObjectURL(p.url))
  }, [files])
  const choose = (next: File[]) => {
    setError('')
    if (next.length > 5) {
      setError('Можно прикрепить до 5 файлов')
      return
    }
    setFiles(next)
    fileDrafts.set(key, next)
  }
  return (
    <>
      <header className="page-header">
        <div className="page-header__content">
          <h1>{admin ? 'Приём жалоб и обращений' : 'Обратная связь'}</h1>
          {!admin && <p>Расскажите, что не работает или что вы хотели бы улучшить.</p>}
        </div>
      </header>
      {admin && <AdminInsights reportsOnly />}
      {!admin && (
        <section className="card feature-panel feedback-form">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (busy || !text.trim()) return
              setBusy(true)
              setError('')
              setNotice('')
              try {
                const uploads = await Promise.all(files.map(uploadFile))
                let record: Feedback
                if (live) {
                  const { data } = await axiosInstance.post<Feedback>('/feedback', {
                    body: text.trim(),
                    file_ids: uploads.map((file) => file.file_id),
                  })
                  record = data
                } else {
                  record = {
                    feedback_id: createId(),
                    body: text.trim(),
                    file_ids: [],
                    mockFiles: uploads,
                    created_at: new Date().toISOString(),
                    status: 'reviewing',
                    userId,
                  }
                  saveMockFeedback([record, ...readMockFeedback()])
                }
                setRecords((items) => [record, ...items])
                setText('')
                setFiles([])
                sessionStorage.removeItem(key)
                fileDrafts.delete(key)
                setNotice(live ? 'Обращение отправлено.' : 'Обращение сохранено в деморежиме.')
              } catch (cause) {
                setError((cause as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            <label>
              Ваше сообщение
              <textarea
                className="textarea"
                required
                maxLength={4000}
                rows={8}
                disabled={busy}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  sessionStorage.setItem(key, e.target.value)
                }}
              />
            </label>
            <fieldset disabled={busy}>
              <FilePicker
                label="Вложения: до 5 файлов"
                files={files}
                onChange={choose}
                accept="image/*,.pdf,.txt,.log"
              />
            </fieldset>
            <div className="feedback-previews">
              {previews.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt={p.name} />
                </a>
              ))}
            </div>
            {!live && <p className="form-hint">Обращение сохранится в этом браузере.</p>}
            <button className="btn btn-primary" disabled={busy || !text.trim()}>
              {busy ? 'Сохранение…' : live ? 'Отправить' : 'Сохранить демообращение'}
            </button>
          </form>
        </section>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {(live || records.length > 0) && (
        <section className="card feature-panel report-section">
          <h2>{admin ? 'Очередь обращений' : 'Мои обращения'}</h2>
          <ReportTableView
            label="Обращения"
            headers={['Дата', 'Сообщение', 'Статус', ...(admin ? ['Действия'] : [])]}
            rows={records.map((record) => ({
              id: record.feedback_id,
              cells: [
                new Date(record.created_at).toLocaleString('ru-RU'),
                <>
                  <p className="preserve-text">{record.body}</p>
                  <div className="action-row">
                    {record.mockFiles?.map((file, index) => (
                      <FileDownload key={index} file={file} />
                    ))}
                    {(record.file_ids || []).map((id, i) => (
                      <FeedbackAttachment
                        key={id}
                        name={`Вложение ${i + 1}`}
                        path={`/feedback/${record.feedback_id}/files/${id}`}
                      />
                    ))}
                  </div>
                </>,
                labels[record.status],
                ...(admin
                  ? [
                      record.status === 'reviewing' && (
                        <div className="action-row">
                          {(['accepted', 'rejected'] as const).map((status) => (
                            <button
                              key={status}
                              className="btn btn-secondary btn-sm"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true)
                                setError('')
                                try {
                                  if (live) {
                                    await axiosInstance.patch(
                                      `/feedback/${record.feedback_id}/status`,
                                      { status },
                                    )
                                  } else {
                                    saveMockFeedback(
                                      readMockFeedback().map((item) =>
                                        item.feedback_id === record.feedback_id
                                          ? { ...item, status }
                                          : item,
                                      ),
                                    )
                                  }
                                  setRecords((items) =>
                                    items.map((item) =>
                                      item.feedback_id === record.feedback_id
                                        ? { ...item, status }
                                        : item,
                                    ),
                                  )
                                } catch (cause) {
                                  setError((cause as Error).message)
                                } finally {
                                  setBusy(false)
                                }
                              }}
                            >
                              {status === 'accepted' ? 'Принять' : 'Отклонить'}
                            </button>
                          ))}
                        </div>
                      ),
                    ]
                  : []),
              ],
            }))}
            emptyText="Обращений пока нет."
          />
        </section>
      )}
    </>
  )
}
