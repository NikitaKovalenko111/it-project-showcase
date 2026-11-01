import React, { useState } from 'react'
import { apiClient } from '../../api/client'
import { useAppDispatch } from '../../store'
import { fetchTeamsRequest } from '../../store/actions'

export const CreateTeamModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch()
  const [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  if (!isOpen) return null
  return <div className="modal-backdrop"><section className="modal-dialog" role="dialog" aria-modal="true" aria-label="Создание команды">
    <div className="modal-dialog__header"><h3>Создать команду</h3></div>
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await apiClient.createTeam({ name: name.trim() }); dispatch(fetchTeamsRequest()); setName(''); onClose() } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}>
      <div className="modal-dialog__body"><label>Название команды<input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></label><p>Вы станете капитаном. После создания найдите студентов по имени или почте и отправьте им приглашения в разделе «Мои команды».</p>{error && <p role="alert">{error}</p>}</div>
      <div className="modal-dialog__footer"><button className="btn btn-primary" disabled={busy || !name.trim()}>Создать команду</button><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Отмена</button></div>
    </form></section></div>
}
