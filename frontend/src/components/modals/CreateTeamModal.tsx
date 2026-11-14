import { TEAM_NAME_MAX_LENGTH } from '../../utils/validation'
import React, { useState } from 'react'
import { apiClient } from '../../api/client'
import { useAppDispatch } from '../../store'
import { fetchTeamsRequest } from '../../store/actions'
import { Modal } from '../Modal'

export const CreateTeamModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch()
  const [name, setName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [description, setDescription] = useState('')
  if (!isOpen) return null
  return (
    <Modal title="Создать команду" onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await apiClient.createTeam({ name: name.trim(), description: description.trim() })
            dispatch(fetchTeamsRequest())
            setName('')
            onClose()
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="modal-dialog__body">
          <label>
            Название команды
            <input
              className="input"
              maxLength={TEAM_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Описание команды
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </label>
          <p>
            Вы станете капитаном. После создания найдите студентов по имени или почте и отправьте им
            приглашения в разделе «Мои команды».
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
        <div className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>
            Создать команду
          </button>
        </div>
      </form>
    </Modal>
  )
}
