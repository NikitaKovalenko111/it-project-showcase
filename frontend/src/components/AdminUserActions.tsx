import { apiRuntime } from '../api/runtime'
import { useConfirmWithReason } from './ConfirmProvider'
import React, { useState } from 'react'
import { User } from '../types/models'
import { apiClient } from '../api/client'
import { useAppSelector } from '../store'
export const AdminUserActions: React.FC<{ user: User }> = ({ user }) => {
  const confirm = useConfirmWithReason()
  const actor = useAppSelector((s) => s.auth.currentUser)
  const [blocked, setBlocked] = useState(!!user.isBlocked),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  if (actor?.role !== 'admin' || actor.id === user.id) return null
  return (
    <section className="action-row">
      <button
        className={blocked ? 'btn btn-secondary' : 'btn btn-danger'}
        disabled={busy}
        onClick={async () => {
          const action = blocked ? 'Разблокировать' : 'Заблокировать'
          const reason = await confirm(
            `${action} пользователя ${user.fullName} (@${user.username})?`,
            action,
            !blocked && apiRuntime.mode !== 'live',
            !blocked,
          )
          if (reason === null) return
          setBusy(true)
          setMessage('')
          try {
            await apiClient.setUserBlock(user, !blocked, reason)
            setBlocked(!blocked)
            setMessage('Статус пользователя изменён')
          } catch (e) {
            setMessage((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {blocked ? 'Разблокировать' : 'Заблокировать'}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
