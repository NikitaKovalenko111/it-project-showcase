import { LocalizedFileInput } from './LocalizedFileInput'
import { useConfirm } from './ConfirmProvider'
import { apiRuntime } from '../api/runtime'
import { axiosInstance } from '../api/http'
import React, { useEffect, useRef, useState } from 'react'
import { User } from '../types/models'
import { uploadFile } from '../utils/files'
import { apiClient } from '../api/client'
import { useAppDispatch } from '../store'
import { fetchStudentsRequest, fetchCurrentUserRequest } from '../store/actions'
function CertificateImage({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  return failed ? (
    <span className="achievement-document">{name} · Предпросмотр недоступен</span>
  ) : (
    <img src={url} alt={name} loading="lazy" onError={() => setFailed(true)} />
  )
}
export const PortfolioFiles: React.FC<{ user: User; editable: boolean }> = ({ user, editable }) => {
  const confirm = useConfirm()
  const dispatch = useAppDispatch()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (preview) dialog.current?.showModal()
    else dialog.current?.close()
  }, [preview])
  const [savedFiles, setSavedFiles] = useState<NonNullable<typeof user.studentProfile>['files']>()
  const files = savedFiles || user.studentProfile?.files || []
  const save = async (next: typeof files) => {
    if (apiRuntime.mode === 'live') {
      const current = ((await axiosInstance.get('/portfolio/me/files')).data.items || []).filter(
        (f: any) => f.kind === 'certificate',
      )
      for (const f of next) {
        if (!f.file_id) throw new Error('Файл ещё не загружен на сервер')
        if (!current.some((c: any) => c.file_id === f.file_id))
          await axiosInstance.post('/portfolio/me/files', {
            file_id: f.file_id,
            kind: 'certificate',
            visibility: 'public',
            is_default: false,
          })
      }
      for (const f of current)
        if (!next.some((n) => n.file_id === f.file_id))
          await axiosInstance.delete(`/portfolio/me/files/${f.file_id}`)
      setSavedFiles((await apiClient.getStudentById(user.id)).studentProfile?.files || [])
      return
    }
    await apiClient.updateUser({
      ...user,
      studentProfile: { ...user.studentProfile!, files: next },
    })
    dispatch(fetchStudentsRequest())
    dispatch(fetchCurrentUserRequest())
  }
  return (
    <section className="card portfolio-achievements">
      <div className="card__header">
        <h3>Достижения и сертификаты</h3>
      </div>
      <div className="card__body">
        {!files.length && <p className="empty-state">Достижений пока нет.</p>}
        <div className="achievement-gallery">
          {files.map((f, i) => (
            <div className="portfolio-file achievement-card" key={f.file_id || f.url}>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Открыть сертификат"
                onClick={(e) => {
                  if (/\.(png|jpe?g|webp|gif)$/i.test(f.name) || f.url.startsWith('data:image/')) {
                    e.preventDefault()
                    setPreview(f)
                  }
                }}
              >
                {/\.(png|jpe?g|webp|gif)$/i.test(f.name) || f.url.startsWith('data:image/') ? (
                  <CertificateImage key={f.url} url={f.url} name={f.name} />
                ) : (
                  <div className="achievement-document">Сертификат / документ</div>
                )}
              </a>
              {editable && (
                <button
                  type="button"
                  className="file-remove"
                  aria-label={`Удалить ${f.name}`}
                  disabled={busy}
                  onClick={async () => {
                    if (!(await confirm(`Удалить файл «${f.name}»?`))) return
                    setBusy(true)
                    try {
                      await save(files.filter((_, j) => j !== i))
                    } catch (e) {
                      setError((e as Error).message)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {editable && (
          <label className="portfolio-upload">
            Добавить фотографии достижений или сертификаты (до 2 МБ)
            <LocalizedFileInput
              className="input"
              accept="image/*,.pdf"
              multiple
              disabled={busy}
              onChange={async (e) => {
                const selected = Array.from(e.target.files || [])
                e.target.value = ''
                setBusy(true)
                setError('')
                try {
                  await save([...files, ...(await Promise.all(selected.map(uploadFile)))])
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <dialog
        ref={dialog}
        className="certificate-preview"
        onCancel={() => setPreview(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPreview(null)
        }}
      >
        {preview && (
          <>
            <button className="btn btn-secondary" autoFocus onClick={() => setPreview(null)}>
              Закрыть ×
            </button>
            <CertificateImage key={preview.url} url={preview.url} name={preview.name} />
          </>
        )}
      </dialog>
    </section>
  )
}
