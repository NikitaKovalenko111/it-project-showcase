import React, { useState } from 'react'
import { apiClient } from '../api/client'
import { useAppDispatch } from '../store'
import { fetchMilestonesRequest } from '../store/actions'

export const MilestoneEditor: React.FC<{ caseId: string; milestoneId?: string }> = ({ caseId, milestoneId }) => {
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (milestoneId) await apiClient.deleteMilestone(milestoneId)
      else await apiClient.createMilestone(caseId, { title, description, deadline })
      dispatch(fetchMilestonesRequest(caseId))
      setOpen(false)
      setTitle(''); setDescription(''); setDeadline('')
    } catch (error) { setError(error instanceof Error ? error.message : 'Не удалось сохранить этап') }
    finally { setBusy(false) }
  }
  return <div>
    {!open ? <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
      {milestoneId ? 'Удалить этап' : '+ Добавить контрольную точку'}
    </button> : <form className="milestone-editor" onSubmit={save}>
      {milestoneId ? <p>Удалить этап вместе с его материалами и рецензией?</p> : <>
        <label>Название этапа<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} /></label>
        <label>Описание<textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label>Срок сдачи<input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required /></label>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="action-row"><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Сохранение…' : milestoneId ? 'Подтвердить удаление' : 'Добавить этап'}</button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => setOpen(false)}>Отмена</button></div>
    </form>}
  </div>
}
