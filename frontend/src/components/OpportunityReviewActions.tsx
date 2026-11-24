import { useState } from 'react'
import { opportunityApi, type Opportunity } from '../api/opportunities'
import { useAppSelector } from '../store'
import { useConfirmWithReason } from './ConfirmProvider'

export function OpportunityBlockButton({
  program,
  onChanged,
}: {
  program: Opportunity
  onChanged: (value: Opportunity) => void
}) {
  const role = useAppSelector((state) => state.auth.currentUser?.role)
  const confirm = useConfirmWithReason()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (role !== 'admin' || !['published', 'closed'].includes(program.status)) return null
  return (
    <>
      <button
        className="btn btn-danger btn-sm"
        disabled={busy}
        onClick={async () => {
          const reason = await confirm(
            `Заблокировать публикацию «${program.title}»?`,
            'Заблокировать',
            true,
            true,
          )
          if (reason === null) return
          setBusy(true)
          setError('')
          try {
            onChanged(
              await opportunityApi.setStatus(
                program.program_id,
                'hidden',
                reason.trim() || 'Решение администратора',
              ),
            )
          } catch (cause) {
            setError((cause as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        Заблокировать
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  )
}

export function OpportunityReviewActions({
  program,
  onChanged,
}: {
  program: Opportunity
  onChanged: (value: Opportunity) => void
}) {
  const role = useAppSelector((state) => state.auth.currentUser?.role)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = program.status === 'moderation'
  const canBlock = role === 'admin' && ['published', 'closed'].includes(program.status)
  if (!pending && !canBlock) return null
  const decide = async (status: string) => {
    setBusy(true)
    setError('')
    try {
      onChanged(await opportunityApi.setStatus(program.program_id, status, comment.trim()))
      setComment('')
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card feature-panel program-review-actions">
      <h3>{pending ? 'Решение по публикации' : 'Управление публикацией'}</h3>
      <label>
        {' '}
        {pending ? 'Комментарий модератора' : 'Причина блокировки'}
        <textarea
          className="textarea"
          rows={3}
          maxLength={4000}
          value={comment}
          disabled={busy}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      <div className="action-row">
        {pending && (
          <>
            <button
              className="btn btn-success btn-sm"
              disabled={busy}
              onClick={() => void decide('published')}
            >
              Одобрить и опубликовать
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={busy || !comment.trim()}
              onClick={() => void decide('revision')}
            >
              На доработку
            </button>
          </>
        )}
        {canBlock && (
          <button
            className="btn btn-danger btn-sm"
            disabled={busy || !comment.trim()}
            onClick={() => void decide('hidden')}
          >
            Заблокировать
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
