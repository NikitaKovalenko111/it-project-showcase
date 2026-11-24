import { useConfirm } from './ConfirmProvider'
import React, { useState } from 'react'
import { CaseProject } from '../types/models'
import { apiClient } from '../api/client'
import { useAppDispatch, useAppSelector } from '../store'
import { updateCaseSuccess } from '../store/actions'
export const AdminCaseActions: React.FC<{ project: CaseProject }> = ({ project }) => {
  const confirm = useConfirm()
  const actor = useAppSelector((s) => s.auth.currentUser),
    dispatch = useAppDispatch()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (actor?.role !== 'admin') return null
  const hidden = project.moderationStatus === 'hidden'
  return (
    <>
      <button
        className={`btn btn-sm ${hidden ? 'btn-secondary' : 'btn-danger'}`}
        disabled={busy}
        onClick={async () => {
          if (
            !(await confirm(
              `${hidden ? 'Восстановить публикацию' : 'Заблокировать кейс'} «${project.title}»?`,
            ))
          )
            return
          setBusy(true)
          setError('')
          try {
            const updated = await apiClient.moderatePublication(
              'case',
              project.id,
              hidden ? 'approved' : 'hidden',
              'Решение администратора из карточки кейса',
            )
            dispatch(updateCaseSuccess(updated as CaseProject))
          } catch (e) {
            const cause = e as Error & { code?: string }
            setError(
              hidden && cause.code === 'invalid_case_transition'
                ? 'Сервер не разрешил восстановить кейс из текущего статуса.'
                : cause.message,
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        {hidden ? 'Восстановить кейс' : 'Заблокировать кейс'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
