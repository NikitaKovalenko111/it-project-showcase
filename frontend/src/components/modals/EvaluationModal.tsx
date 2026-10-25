import React, { useState } from 'react'
import confetti from 'canvas-confetti'
import { useAppDispatch, useAppSelector } from '../../store'
import { createEvaluationRequest } from '../../store/actions'
import { Award, Check, Star, Trophy, X } from 'lucide-react'

interface EvaluationModalProps {
  caseId: string
  caseTitle: string
  teamName?: string
  companyId: string
  companyName: string
  isContest: boolean
  isOpen: boolean
  onClose: () => void
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  caseId,
  caseTitle,
  teamName,
  companyId,
  companyName,
  isContest,
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)

  const [scores, setScores] = useState({
    solutionCompleteness: 10,
    implementationQuality: 9,
    codeQuality: 10,
    architecture: 9,
    specCompliance: 10,
    usability: 9,
    originality: 9,
    documentationQuality: 9,
    deadlineCompliance: 10,
    teamwork: 10,
  })

  const [feedback, setFeedback] = useState(
    'Решение выполнено на высоком профессиональном уровне. Архитектура сервиса масштабируема, код чистый, покрыт тестами. Проект рекомендован к промышленному внедрению!'
  )
  const [winnerPlace, setWinnerPlace] = useState<number | undefined>(isContest ? 1 : undefined)
  const [nomination, setNomination] = useState(isContest ? 'Лучшее индустриальное решение' : '')

  if (!isOpen) return null

  const criteriaLabels = [
    { key: 'solutionCompleteness', label: '1. Полнота решения' },
    { key: 'implementationQuality', label: '2. Качество реализации' },
    { key: 'codeQuality', label: '3. Качество программного кода' },
    { key: 'architecture', label: '4. Архитектура сервиса' },
    { key: 'specCompliance', label: '5. Соответствие техническому заданию' },
    { key: 'usability', label: '6. Удобство использования (UX/UI)' },
    { key: 'originality', label: '7. Оригинальность подхода' },
    { key: 'documentationQuality', label: '8. Качество документации' },
    { key: 'deadlineCompliance', label: '9. Соблюдение сроков' },
    { key: 'teamwork', label: '10. Командная работа' },
  ]

  const totalScore = Object.values(scores).reduce((acc, curr) => acc + curr, 0)

  const handleScoreChange = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    dispatch(
      createEvaluationRequest({
        caseId,
        companyId,
        companyName,
        evaluatorName: currentUser?.fullName || 'Представитель компании',
        scores,
        totalScore,
        maxScore: 100,
        feedback,
        winnerPlace,
        nomination: nomination || undefined,
      })
    )

    if (winnerPlace === 1) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      })
    }

    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div>
            <h3>Оценка результатов выполнения проекта</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Проект: {caseTitle} • Оценивает: {companyName}
              <br />Исполнители: {teamName || 'Не назначены'}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog__body">
            {/* Total Score Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f2b48, #1b5e91)',
                color: '#fff',
                padding: '16px 20px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#90d0de' }}>
                  Итоговая оценка по 100-балльной шкале
                </span>
                <div style={{ fontSize: '32px', fontWeight: 800 }}>{totalScore} / 100</div>
              </div>
              <Star size={36} color="#fbbf24" fill="#fbbf24" />
            </div>

            {/* 10 Evaluation Criteria Sliders */}
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: '20px' }}>
              {criteriaLabels.map(({ key, label }) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    <span>{label}</span>
                    <span style={{ color: '#1b5e91' }}>{(scores as any)[key]} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={(scores as any)[key]}
                    onChange={(e) => handleScoreChange(key, Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>

            {/* Contest Winner Picker */}
            {isContest && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Trophy size={18} color="#d97706" />
                  <strong style={{ fontSize: '13px', color: '#0f2b48' }}>
                    Определение победителя и призового места:
                  </strong>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  {[1, 2, 3].map((place) => (
                    <button
                      key={place}
                      type="button"
                      className={`btn ${winnerPlace === place ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setWinnerPlace(place)}
                      style={{ flex: 1 }}
                    >
                      <Trophy size={14} /> {place} место
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`btn ${winnerPlace === undefined ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setWinnerPlace(undefined)}
                  >
                    Без места
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Специальная номинация (опционально):</label>
                  <input
                    type="text"
                    className="input"
                    value={nomination}
                    onChange={(e) => setNomination(e.target.value)}
                    placeholder="Например: Лучшая архитектура, За высокое качество кода"
                  />
                </div>
              </div>
            )}

            {/* Text Feedback */}
            <div className="form-group">
              <label>Официальный отзыв и рецензия компании:*</label>
              <textarea
                className="textarea"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Напишите развернутый отзыв о результатах работы студентов..."
                required
              />
              <span className="form-hint">
                Отзыв будет опубликован в карточке проекта и в подтвержденном портфолио студента с отметкой компании.
              </span>
            </div>
          </div>

          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              <Award size={16} /> Сохранить оценку и отзыв
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
