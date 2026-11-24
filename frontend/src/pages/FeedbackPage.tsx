import { AttachmentPreview } from '../components/AttachmentPreview'
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
  status: 'reviewing' | 'reviewed' | 'accepted' | 'rejected'
  userId?: string
  mockFiles?: { name: string; url: string }[]
}
const labels = {
  reviewing: 'На рассмотрении',
  reviewed: 'Рассмотрено',
  accepted: 'Сделано',
  rejected: 'Отклонено',
}
const mockFeedbackKey = 'showcase_curated_v1_feedback'
const readMockFeedback = (): Feedback[] => JSON.parse(localStorage.getItem(mockFeedbackKey) || '[]')
const saveMockFeedback = (records: Feedback[]) =>
  localStorage.setItem(mockFeedbackKey, JSON.stringify(records))
const fileDrafts = new Map<string, File[]>()
const feedbackInterval = 60_000
const feedbackLimit = 3

function feedbackRetryAt(records: Feedback[], now: number) {
  const recent = records
    .map((record) => Date.parse(record.created_at))
    .filter((date) => now - date < feedbackInterval)
    .sort((first, second) => second - first)
  return recent.length >= feedbackLimit ? recent[feedbackLimit - 1] + feedbackInterval : 0
}

function retryAfterDeadline(header: unknown, now: number) {
  if (typeof header !== 'string') return now + feedbackInterval
  const deadline = /^\d+$/.test(header) ? now + Number(header) * 1000 : Date.parse(header)
  return Number.isFinite(deadline) ? deadline : now + feedbackInterval
}

export const FeedbackPage: React.FC = () => {
  const user = useAppSelector((s) => s.auth.currentUser)
  const userId = user?.id || 'guest'
  return <FeedbackWorkspace key={userId} userId={userId} admin={user?.role === 'admin'} />
}

function FeedbackWorkspace({ userId, admin }: { userId: string; admin: boolean }) {
  const live = apiRuntime.mode === 'live'
  const key = `feedback-draft:${userId}`
  const cooldownKey = `feedback-cooldown:${userId}`
  const [text, setText] = useState(() => sessionStorage.getItem(key) || ''),
    [files, setFiles] = useState<File[]>(() => fileDrafts.get(key) || []),
    [error, setError] = useState('')
  const [records, setRecords] = useState<Feedback[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(live)
  const [serverRetryAt, setServerRetryAt] = useState(
    () => Number(localStorage.getItem(cooldownKey)) || 0,
  )
  const [now, setNow] = useState(Date.now)
  const retryAt = Math.max(serverRetryAt, admin ? 0 : feedbackRetryAt(records, now))
  const secondsRemaining = Math.max(0, Math.ceil((retryAt - now) / 1000))

  useEffect(() => {
    if (!secondsRemaining) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(1000, retryAt - now))
    return () => window.clearTimeout(timer)
  }, [now, retryAt, secondsRemaining])

  useEffect(() => {
    let active = true
    if (live)
      collectNumbered<Feedback>((params) =>
        axiosInstance.get(admin ? '/feedback' : '/feedback/mine', { params }),
      )
        .then((rows) => {
          if (active) {
            setRecords(rows)
            setNow(Date.now())
          }
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    else setRecords(readMockFeedback().filter((item) => admin || item.userId === userId))
    return () => {
      active = false
    }
  }, [admin, userId, live])
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
  const sortedRecords = [...records].sort(
    (first, second) => Date.parse(second.created_at) - Date.parse(first.created_at),
  )
  return (
    <>
      <header className="page-header">
        <div className="page-header__content">
          <h1>{admin ? 'Приём жалоб и обращений' : 'Обратная связь'}</h1>
        </div>
      </header>
      {admin && <AdminInsights reportsOnly />}
      {!admin && (
        <section className="card feature-panel feedback-form">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const form = e.currentTarget
              const body = text.trim()
              if (busy || loading || !body) return
              const submittedAt = Date.now()
              const myRecords = live
                ? records
                : readMockFeedback().filter((record) => record.userId === userId)
              const serverDeadline = Number(localStorage.getItem(cooldownKey)) || 0
              const retryAt = Math.max(serverDeadline, feedbackRetryAt(myRecords, submittedAt))
              if (retryAt > submittedAt) {
                setNow(submittedAt)
                setRecords(myRecords)
                setServerRetryAt(serverDeadline)
                setError('')
                setNotice('')
                return
              }
              if (
                !files.length &&
                myRecords.some(
                  (record) =>
                    record.body === body &&
                    !record.file_ids?.length &&
                    !record.mockFiles?.length &&
                    submittedAt - Date.parse(record.created_at) < feedbackInterval,
                )
              ) {
                setNotice('')
                setError('Такое обращение уже отправлено.')
                return
              }
              setBusy(true)
              setError('')
              setNotice('')
              try {
                const uploads = await Promise.all(files.map(uploadFile))
                let record: Feedback
                if (live) {
                  const { data } = await axiosInstance.post<Feedback>('/feedback', {
                    body,
                    file_ids: uploads.map((file) => file.file_id),
                  })
                  record = data
                } else {
                  record = {
                    feedback_id: createId(),
                    body,
                    file_ids: [],
                    mockFiles: uploads,
                    created_at: new Date().toISOString(),
                    status: 'reviewing',
                    userId,
                  }
                  saveMockFeedback([record, ...readMockFeedback()])
                }
                setRecords([record, ...myRecords])
                setNow(Date.now())
                form.reset()
                setText('')
                setFiles([])
                sessionStorage.removeItem(key)
                fileDrafts.delete(key)
                setNotice('Обращение отправлено.')
              } catch (cause) {
                const failure = cause as Error & { status?: number; retryAfter?: unknown }
                if (failure.status === 429) {
                  const receivedAt = Date.now()
                  const retryAt = retryAfterDeadline(failure.retryAfter, receivedAt)
                  localStorage.setItem(cooldownKey, String(retryAt))
                  setServerRetryAt(retryAt)
                  setNow(receivedAt)
                  if (retryAt <= receivedAt)
                    setError('Сервер ограничил отправку. Повторите попытку.')
                } else setError(failure.message)
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
            <button
              className="btn btn-primary"
              disabled={busy || loading || !!secondsRemaining || !text.trim()}
            >
              {busy ? 'Отправка…' : 'Отправить'}
            </button>
            {!!secondsRemaining && (
              <p className="form-hint">
                Следующее обращение можно отправить через {secondsRemaining} сек.
              </p>
            )}
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
        <section className="card feature-panel report-section feedback-queue">
          <h2>{admin ? 'Очередь обращений' : 'Мои обращения'}</h2>
          <ReportTableView
            label="Обращения"
            headers={['Дата', 'Сообщение', 'Статус', ...(admin ? ['Действия'] : [])]}
            rows={sortedRecords.map((record) => ({
              id: record.feedback_id,
              cells: [
                new Date(record.created_at).toLocaleString('ru-RU'),
                <>
                  <p className="preserve-text">{record.body}</p>
                  <div className="action-row">
                    {record.mockFiles?.map((file, index) => (
                      <AttachmentPreview key={index} file={file} />
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
                      record.status !== 'accepted' && record.status !== 'rejected' && (
                        <div className="action-row feedback-queue__actions">
                          {(
                            (live
                              ? ['accepted', 'rejected']
                              : ['reviewed', 'accepted', 'rejected']) as Feedback['status'][]
                          ).map((status) => (
                            <button
                              key={status}
                              className={`btn btn-sm ${status === 'rejected' ? 'btn-danger' : status === 'accepted' ? 'btn-success' : 'btn-secondary'}`}
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
                              {status === 'accepted'
                                ? 'Сделано'
                                : status === 'reviewed'
                                  ? 'Рассмотрено'
                                  : 'Отклонено'}
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
