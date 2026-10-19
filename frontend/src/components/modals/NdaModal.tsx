import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { acceptNDARequest } from '../../store/actions'
import { CaseProject } from '../../types/models'
import { FileLock2, ShieldCheck, X } from 'lucide-react'

interface NdaModalProps {
  caseItem: CaseProject
  isOpen: boolean
  onClose: () => void
  onAccepted: () => void
}

export const NdaModal: React.FC<NdaModalProps> = ({ caseItem, isOpen, onClose, onAccepted }) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)
  const [agreed, setAgreed] = useState(false)

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!agreed) return
    if (currentUser) {
      dispatch(acceptNDARequest(caseItem.id, currentUser.id))
      onAccepted()
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileLock2 size={22} color="#b91c1c" />
            <div>
              <h3 style={{ color: '#991b1b' }}>Соглашение о неразглашении конфиденциальной информации (NDA)</h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Проект: {caseItem.title} • {caseItem.companyName}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-dialog__body">
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#334155',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>
              ТИПОВОЕ СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ (NDA)
            </h4>
            <p>
              Настоящее Соглашение заключается между <strong>{caseItem.companyName}</strong> (далее – «Раскрывающая
              сторона») и обучающимся УУНиТ <strong>{currentUser?.fullName}</strong> (далее – «Принимающая сторона»).
            </p>
            <p>
              1. <strong>Предмет соглашения:</strong> Раскрывающая сторона предоставляет Принимающей стороне доступ к
              полному тексту технического задания, архитектурным схемам, закрытым датасетам и исходным кодам в рамках
              выполнения кейса «{caseItem.title}».
            </p>
            <p>
              2. <strong>Обязательства:</strong> Принимающая сторона обязуется не распространять, не передавать третьим
              лицам и не публиковать в открытых источниках конфиденциальные сведения без предварительного письменного
              согласия компании.
            </p>
            <p>
              3. <strong>Срок действия:</strong> Соглашение вступает в силу с момента подтверждения и действует в
              течение 3 (трех) лет.
            </p>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1e293b',
              }}
            >
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              Я подтверждаю подписание соглашения о неразглашении и принимаю условия конфиденциальности
            </label>
          </div>
        </div>

        <div className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Отклонить и закрыть
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!agreed}
            onClick={handleConfirm}
            style={{ background: '#b91c1c' }}
          >
            <ShieldCheck size={16} /> Подписать NDA и открыть ТЗ
          </button>
        </div>
      </div>
    </div>
  )
}
