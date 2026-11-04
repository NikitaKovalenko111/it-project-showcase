import { FilePicker } from './FilePicker'
import { uploadFile } from '../utils/files'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { File, Link as LinkIcon, X } from 'lucide-react'
import { useAppDispatch } from '../store'
import { submitMilestoneSuccess } from '../store/actions'
import { apiClient } from '../api/client'

export const MilestoneMaterials: React.FC<{ milestoneId: string }> = ({ milestoneId }) => {
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'file' | 'link'>('file')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal() }, [open])
  const [url, setUrl] = useState('')
  return <>
    <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setOpen(true) }}>Прикрепить материалы</button>
    {open && createPortal(<dialog ref={dialog} className="object-dialog" aria-labelledby={`materials-${milestoneId}`} onCancel={(event) => { if (saving) event.preventDefault(); else setOpen(false) }}>
    <div className="modal-dialog__header"><h2 id={`materials-${milestoneId}`}>Прикрепить материалы</h2><button className="close-btn" aria-label="Закрыть" disabled={saving} onClick={() => setOpen(false)}><X size={18} /></button></div>
    <form onSubmit={async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (!files.length) throw new Error('Выберите файлы')
      const materials = await Promise.all(files.map(uploadFile))
      const updated = await apiClient.submitMilestone(milestoneId, materials)
      dispatch(submitMilestoneSuccess(updated))
      setOpen(false)
      setFiles([])
      setUrl('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось прикрепить материал.') }
    finally { setSaving(false) }
  }}>
    <div className="modal-dialog__body">
      <FilePicker label="Материалы (каждый до 2 МБ)" files={files} onChange={setFiles} />
      {error && <p role="alert">{error}</p>}
    </div>
    <div className="modal-dialog__footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setOpen(false)}>Отмена</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Отправка…' : 'Отправить на проверку'}</button></div>
  </form></dialog>, document.body)}</>
}
