import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Flag, X } from 'lucide-react'
import { communityApi } from '../api/community'
import { ContentReport } from '../types/models'
import { useAppSelector } from '../store'

export const ReportButton: React.FC<{
  targetType: ContentReport['targetType']
  targetId: string
  compact?: boolean
}> = ({ targetType, targetId, compact = false }) => {
  const user = useAppSelector((s) => s.auth.currentUser)
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState('Спам'),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false)
  const reportLabel = {
    company: 'Пожаловаться на компанию',
    case: 'Пожаловаться на кейс',
    user: 'Пожаловаться на пользователя',
    project: 'Пожаловаться на проект',
    comment: 'Пожаловаться на комментарий',
  }[targetType]
  if (!user) return null
  return (
    <>
      <button
        className={`btn btn-secondary btn-sm report-trigger ${compact ? 'report-trigger--icon' : ''}`}
        aria-label={reportLabel}
        title={reportLabel}
        onClick={() => setOpen(true)}
      >
        <Flag size={16} />
        <span>{reportLabel}</span>
      </button>
      {open &&
        createPortal(
          <div className="modal-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Жалоба"
              className="modal-dialog report-dialog"
            >
              <div className="modal-dialog__header">
                <h3>Пожаловаться</h3>
                <button
                  aria-label="Закрыть жалобу"
                  className="close-btn"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setBusy(true)
                  setError('')
                  try {
                    await communityApi.reportContent(targetType, targetId, reason, message)
                    setSent(true)
                  } catch (e) {
                    setError((e as Error).message)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <div className="modal-dialog__body">
                  {sent ? (
                    <p role="status">Жалоба отправлена администратору.</p>
                  ) : (
                    <>
                      <label>
                        Причина
                        <select
                          className="select"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        >
                          {[
                            'Спам',
                            'Оскорбления',
                            'Недостоверная информация',
                            'Нарушение авторских прав',
                            'Другое',
                          ].map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Комментарий
                        <textarea
                          className="textarea"
                          maxLength={2000}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          required={reason === 'Другое'}
                        />
                      </label>
                    </>
                  )}
                  {error && <p role="alert">{error}</p>}
                </div>
                <div className="modal-dialog__footer">
                  {!sent && (
                    <button className="btn btn-primary" disabled={busy}>
                      {busy ? 'Отправка…' : 'Отправить жалобу'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setOpen(false)}
                  >
                    Закрыть
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  )
}
