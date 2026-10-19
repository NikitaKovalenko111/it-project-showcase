import React, { useState } from 'react'
import { useAppDispatch } from '../store'
import { submitMilestoneRequest } from '../store/actions'

export const MilestoneMaterials: React.FC<{ milestoneId: string }> = ({ milestoneId }) => {
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  return open ? <form className="milestone-editor" onSubmit={(event) => {
    event.preventDefault()
    if (!/^https?:\/\//i.test(url)) return
    dispatch(submitMilestoneRequest(milestoneId, [{ name: name.trim(), url }]))
    setOpen(false)
  }}>
    <label>Название материала<input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
    <label>Ссылка на файл или репозиторий<input className="input" type="url" pattern="https?://.*" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required /></label>
    <div className="action-row"><button className="btn btn-primary btn-sm">Отправить на проверку</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Отмена</button></div>
  </form> : <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>Прикрепить материалы</button>
}
