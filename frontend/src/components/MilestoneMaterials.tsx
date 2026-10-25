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
  const [file, setFile] = useState<File | null>(null)
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
      let material: { name: string; url: string; size?: string }
      if (kind === 'file') {
        if (!file) return
        if (file.size > 2 * 1024 * 1024) throw new Error('Выберите файл до 2 МБ или прикрепите ссылку на него.')
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('Не удалось прочитать файл.'))
          reader.readAsDataURL(file)
        })
        material = { name: file.name, url: data, size: `${Math.ceil(file.size / 1024)} КБ` }
      } else {
        const parsed = new URL(url.trim())
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Укажите HTTP или HTTPS ссылку.')
        material = { name: decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname), url: parsed.href }
      }
      const updated = await apiClient.submitMilestone(milestoneId, [material])
      dispatch(submitMilestoneSuccess(updated))
      setOpen(false)
      setFile(null)
      setUrl('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось прикрепить материал.') }
    finally { setSaving(false) }
  }}>
    <div className="modal-dialog__body">
      <div className="action-row" style={{ marginBottom: 16 }}>
        <button type="button" className={`btn btn-${kind === 'file' ? 'primary' : 'secondary'}`} aria-pressed={kind === 'file'} onClick={() => setKind('file')}><File size={16} /> Файл</button>
        <button type="button" className={`btn btn-${kind === 'link' ? 'primary' : 'secondary'}`} aria-pressed={kind === 'link'} onClick={() => setKind('link')}><LinkIcon size={16} /> Ссылка</button>
      </div>
      {kind === 'file' ? <label>Файл (до 2 МБ)<input className="input" type="file" required onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        : <label>Ссылка на материал<input autoFocus className="input" type="url" pattern="https?://.*" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required /></label>}
      {error && <p role="alert">{error}</p>}
    </div>
    <div className="modal-dialog__footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setOpen(false)}>Отмена</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Отправка…' : 'Отправить на проверку'}</button></div>
  </form></dialog>, document.body)}</>
}
