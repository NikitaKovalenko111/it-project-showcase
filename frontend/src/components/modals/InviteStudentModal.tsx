import { apiClient } from '../../api/client'
import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { inviteStudentRequest } from '../../store/actions'
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
  const dispatch = useAppDispatch()
  const { casesList } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)

  const companyCases = casesList.filter((c) =>
    currentUser?.companyProfile?.companyId
      ? c.companyId === currentUser.companyProfile.companyId
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
      const caseId = selectedCaseId || companyCases[0]?.id
      if (!caseId) throw new Error('Выберите кейс')
      await apiClient.inviteStudent(student.id, caseId, inviteType, message)
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
                  onChange={(e) => setInviteType(e.target.value)}
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

              <div className="form-group">
                <label>Выберите проект/кейс компании:*</label>
                <select
                  className="select"
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  required
                >
                  {companyCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} (
                      {c.rewardType === 'contest' ? `Призовой фонд ${c.prizeFund} ₽` : c.direction})
                    </option>
                  ))}
                </select>
              </div>

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
