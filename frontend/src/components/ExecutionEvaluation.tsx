import React, { useState } from 'react'
import { Award, Star } from 'lucide-react'
import { CaseProject } from '../types/models'
import { Execution } from '../types/execution'
import { communityApi } from '../api/community'
import { evaluationTotal, legacyCriteria } from '../utils/evaluation'
import { Modal } from './Modal'

export const ExecutionEvaluation: React.FC<{
  project: CaseProject
  entry: Execution
  onClose: () => void
  onSaved: () => Promise<void>
}> = ({ project, entry, onClose, onSaved }) => {
  const olympiad = project.kind === 'olympiad',
    criteria = project.evaluationCriteria || legacyCriteria
  const items = olympiad
    ? (project.olympiadTasks || []).map((t) => ({
        id: t.id,
        label: t.title,
        max: t.maxScore,
        weight: 1,
      }))
    : criteria.map((c) => ({ ...c, max: c.maxScore ?? 10 }))
  const [scores, setScores] = useState<Record<string, number>>(entry.evaluation?.scores || {}),
    [feedback, setFeedback] = useState(entry.evaluation?.feedback || '')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const total = olympiad
      ? items.reduce((s, c) => s + (scores[c.id] || 0), 0)
      : evaluationTotal(criteria, scores),
    max = items.reduce((s, c) => s + c.max, 0)
  return (
    <Modal title={olympiad ? 'Баллы за задания' : 'Оценка решения'} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await communityApi.gradeExecution(
              entry.id,
              Object.fromEntries(items.map((c) => [c.id, scores[c.id] || 0])),
              feedback,
            )
            await onSaved()
            onClose()
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="modal-dialog__body">
          <p>
            <strong>{entry.name}</strong>
          </p>
          <div className="score-banner">
            <div>
              <small>Итоговая оценка</small>
              <strong>
                {total} / {max}
              </strong>
            </div>
            <Star size={36} color="#fbbf24" fill="#fbbf24" />
          </div>
          <p>
            {olympiad
              ? 'Итог — сумма баллов за задания. У каждого задания свой максимум.'
              : 'Итог — сумма баллов. У каждого критерия свой максимум.'}
          </p>
          <div className="score-criteria">
            {items.map((c) => (
              <label key={c.id}>
                <span>
                  <strong>{c.label}</strong>
                  <output>
                    {scores[c.id] || 0} / {c.max}
                  </output>
                </span>
                {olympiad ? (
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max={c.max}
                    step="0.1"
                    value={scores[c.id] || 0}
                    onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                  />
                ) : (
                  <input
                    type="range"
                    min="0"
                    max={c.max}
                    step="1"
                    value={scores[c.id] || 0}
                    onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                  />
                )}
              </label>
            ))}
          </div>
          {!items.length && <p>Сначала добавьте задания олимпиады в настройки публикации.</p>}
          <label>
            Рецензия компании
            <textarea
              className="textarea"
              required
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Что получилось и что можно улучшить"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy || !items.length}>
            <Award size={16} /> Сохранить оценку и отзыв
          </button>
        </div>
      </form>
    </Modal>
  )
}
