import { apiClient } from '../../api/client'
import React, { useState, useEffect } from 'react'
import { useAppSelector } from '../../store'
import { User } from '../../types/models'
import { CheckCircle2, Send, UserCheck, X } from 'lucide-react'

interface InviteStudentModalProps {
  student: User
  isOpen: boolean
  onClose: () => void
}

export const InviteStudentModal: React.FC<InviteStudentModalProps> = ({
  student,
  isOpen,
  onClose,
}) => {
  const { casesList } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)

  const companyCases = casesList.filter((c) =>
    currentUser?.companyProfile?.companyId
      ? c.companyId === currentUser.companyProfile.companyId &&
        ['open', 'in_progress'].includes(c.status)
      : true,
  )

  const [selectedCaseId, setSelectedCaseId] = useState(companyCases[0]?.id || '')
  const [inviteType, setInviteType] = useState('Участие в проекте')
  const [message, setMessage] = useState(
    `Здравствуйте, ${student.fullName}! Ознакомились с вашим профилем и проектами. Ваши компетенции отлично подходят под наш кейс. Будем рады видеть вас среди исполнителей!`,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setInviteType('Участие в проекте')
      setSent(false)
      setError('')
      setSelectedCaseId('')
      setMessage(`Здравствуйте, ${student.fullName}! Приглашаем обсудить участие в нашем проекте.`)
    }
  }, [isOpen, student.id])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const caseId = inviteType === 'Участие в проекте' ? selectedCaseId : ''
      if (inviteType === 'Участие в проекте' && !caseId) throw new Error('Выберите проект')
      await apiClient.inviteStudent(
        student.id,
        caseId,
        inviteType,
        message,
        currentUser?.companyProfile?.companyId,
      )
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog student-invite-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserCheck size={20} color="#1b5e91" />
            <div>
              <h3>Приглашение студента</h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Кандидат: <strong>{student.fullName}</strong> (
                {student.studentProfile?.group || 'УУНиТ'})
              </p>
            </div>
          </div>
          <button aria-label="Закрыть приглашение" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <CheckCircle2 size={44} color="#16805b" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ color: '#16805b', margin: '0 0 6px' }}>Приглашение успешно отправлено!</h4>
            <p style={{ color: '#64748b', fontSize: '12px' }}>
              Студент получит приглашение в личном кабинете.
            </p>
            <button className="btn btn-primary" onClick={onClose}>
              Готово
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p role="alert">{error}</p>}
            <div className="modal-dialog__body">
              <div className="form-group">
                <label>Тип приглашения:*</label>
                <select
                  className="select"
                  value={inviteType}
                  onChange={(e) => {
                    const type = e.target.value
                    setInviteType(type)
                    setSelectedCaseId('')
                    setMessage(
                      `Здравствуйте, ${student.fullName}! ${type === 'Участие в проекте' ? 'Приглашаем обсудить участие в нашем проекте.' : type === 'Техническое собеседование' ? 'Приглашаем вас на техническое собеседование в нашу компанию.' : 'Приглашаем вас на стажировку в нашей компании.'}`,
                    )
                  }}
                >
                  <option value="Участие в проекте">
                    Участие в проекте (индивидуально/командой)
                  </option>
                  <option value="Оплачиваемая стажировка">
                    Оплачиваемая стажировка в компании
                  </option>
                  <option value="Техническое собеседование">
                    Приглашение на техническое собеседование
                  </option>
                </select>
              </div>

              {inviteType === 'Участие в проекте' ? (
                <div className="form-group">
                  <label>Выберите проект/кейс компании:*</label>
                  <select
                    aria-label="Проект для приглашения"
                    className="select"
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    required
                  >
                    <option value="">Выберите проект</option>
                    {companyCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (
                        {c.rewardType === 'contest'
                          ? `Призовой фонд ${c.prizeFund} ₽`
                          : c.direction}
                        )
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="invitation-context-note">
                  Приглашение от компании, без привязки к проекту.
                </p>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Персональное сообщение / оффер:*</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: '100px' }}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-dialog__footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <Send size={15} /> Отправить приглашение
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
