import { useState } from 'react'
import { companyMembershipApi } from '../api/client'
import { Modal } from './Modal'

export function InviteCompanyMember({
  companyId,
  actorId,
  onClose,
}: {
  companyId: string
  actorId: string
  onClose: () => void
}) {
  const [userId, setUserId] = useState('')
  const [position, setPosition] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal title="Пригласить в компанию" onClose={onClose}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy || sent) return
          const recipient = userId.trim().toLowerCase()
          if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(recipient))
            return setError('Укажите ID пользователя в формате UUID.')
          if (recipient === actorId) return setError('Вы уже состоите в этой компании.')
          setBusy(true)
          setError('')
          try {
            await companyMembershipApi.invite(companyId, recipient, position.trim())
            setSent(true)
          } catch (cause) {
            const failure = cause as Error & { status?: number; code?: string }
            setError(
              failure.status === 409
                ? 'Для этого пользователя уже может быть активное приглашение.'
                : failure.code === 'representative_approval_required'
                  ? 'Пригласить можно активного пользователя с одобренной ролью представителя.'
                  : failure.status === 404
                    ? 'Приглашение недоступно. Проверьте статус компании и членство пользователя.'
                    : failure.message,
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="modal-dialog__body">
          {sent ? (
            <p role="status">Приглашение отправлено во входящие заявки пользователя.</p>
          ) : (
            <>
              <p>
                Попросите представителя скопировать свой ID в разделе «Моя компания». После принятия
                приглашения он получит право управлять компанией.
              </p>
              <label className="form-group">
                ID пользователя
                <input
                  className="input"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  autoComplete="off"
                  required
                  disabled={busy}
                />
              </label>
              <label className="form-group">
                Должность
                <input
                  className="input"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  maxLength={150}
                  disabled={busy}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
        <footer className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {sent ? 'Готово' : 'Закрыть'}
          </button>
          {!sent && (
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Отправляем…' : 'Отправить приглашение'}
            </button>
          )}
        </footer>
      </form>
    </Modal>
  )
}
