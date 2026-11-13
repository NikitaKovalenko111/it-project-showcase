import { useConfirm } from './ConfirmProvider'
import React, { useState } from 'react'
import { Company } from '../types/models'
import { apiClient } from '../api/client'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCompanyByIdSuccess, fetchCompaniesRequest } from '../store/actions'
export const AdminCompanyActions: React.FC<{ company: Company }> = ({ company }) => {
  const confirm = useConfirm()
  const actor = useAppSelector((s) => s.auth.currentUser),
    dispatch = useAppDispatch()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (actor?.role !== 'admin') return null
  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        disabled={busy || company.isBlocked}
        onClick={async () => {
          if (!(await confirm(`Приостановить деятельность компании «${company.name}»?`))) return
          setBusy(true)
          setError('')
          try {
            dispatch(fetchCompanyByIdSuccess(await apiClient.suspendCompany(company.id)))
            dispatch(fetchCompaniesRequest())
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {company.isBlocked ? 'Компания заблокирована' : 'Заблокировать компанию'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
