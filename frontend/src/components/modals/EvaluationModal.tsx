import { legacyCriteria, evaluationTotal } from '../../utils/evaluation'
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

  const project = useAppSelector(state => state.cases.casesList.find(c => c.id === caseId) || state.cases.activeCase)
  const [scores, setScores] = useState<Record<string, number>>({})


  const [feedback, setFeedback] = useState(
    'Решение выполнено на высоком профессиональном уровне. Архитектура сервиса масштабируема, код чистый, покрыт тестами. Проект рекомендован к промышленному внедрению!'
  )
  const [winnerPlace, setWinnerPlace] = useState<number | undefined>(undefined)
  const [nomination, setNomination] = useState(isContest ? 'Лучшее индустриальное решение' : '')

  if (!isOpen) return null

  const criteriaLabels = (project?.evaluationCriteria || legacyCriteria).map(c => ({key:c.id,label:c.label,weight:c.weight}))
  const maxScore = criteriaLabels.length * 10
  const totalScore = evaluationTotal(criteriaLabels.map(c => ({id:c.key,label:c.label,weight:c.weight})), scores)

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
        scores: Object.fromEntries(criteriaLabels.map(c => [c.key, scores[c.key] || 0])),
        totalScore,
        maxScore,
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
                  Итоговая оценка
                </span>
                <div style={{ fontSize: '32px', fontWeight: 800 }}>{totalScore} / {maxScore}</div>
              </div>
              <Star size={36} color="#fbbf24" fill="#fbbf24" />
            </div>

            {/* 10 Evaluation Criteria Sliders */}
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: '20px' }}>
              {criteriaLabels.map(({ key, label, weight }) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    <span>{label} · вес {weight}</span>
                    <span style={{ color: '#1b5e91' }}>{scores[key] || 0} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={scores[key] || 0}
                    onChange={(e) => handleScoreChange(key, Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>

            <p>Места распределяются в общем лидерборде после оценки всех решений.</p>
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
            <button disabled={!criteriaLabels.length} type="submit" className="btn btn-primary">
              <Award size={16} /> Сохранить оценку и отзыв
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
