import { useConfirm } from './ConfirmProvider'
import React, { useState } from 'react'
import { Company } from '../types/models'
import { apiClient } from '../api/client'
import { useAppDispatch, useAppSelector } from '../store'
import { verifyCompanySuccess } from '../store/actions'
export const AdminCompanyActions: React.FC<{ company: Company }> = ({ company }) => {
  const confirm = useConfirm()
  const actor = useAppSelector((s) => s.auth.currentUser),
    dispatch = useAppDispatch()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (actor?.role !== 'admin') return null
  const suspended = company.isBlocked
  if (!suspended && !company.isVerified) return null
  return (
    <>
      <button
        className={`btn btn-sm ${suspended ? 'btn-secondary' : 'btn-danger'}`}
        disabled={busy}
        onClick={async () => {
          const action = suspended ? 'Восстановить компанию' : 'Приостановить деятельность компании'
          if (!(await confirm(`${action} «${company.name}»?`))) return
          setBusy(true)
          setError('')
          try {
            const updated = suspended
              ? await apiClient.restoreCompany(company.id)
              : await apiClient.suspendCompany(company.id)
            dispatch(verifyCompanySuccess(updated))
          } catch (e) {
            const cause = e as Error & { code?: string }
            setError(
              suspended && cause.code === 'company_request_failed'
                ? 'Сервер не смог восстановить компанию. Компания остаётся заблокированной.'
                : cause.message,
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        {suspended ? 'Восстановить компанию' : 'Заблокировать компанию'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
