import { createPortfolioApi } from '../api/portfolio'
import { ApiImage } from './ApiImage'
import { FileDownload } from './FileDownload'
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
  return <ApiImage src={url} alt={name} loading="lazy" />
}
const portfolioApi = createPortfolioApi(axiosInstance, apiRuntime.baseUrl || '/api/v1')
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
  const [loading, setLoading] = useState(apiRuntime.mode === 'live')
  const files = savedFiles || user.studentProfile?.files || []
  const reload = async () => setSavedFiles(await portfolioApi.list(user.id, editable))
  useEffect(() => {
    if (apiRuntime.mode !== 'live') return
    let active = true
    setLoading(true)
    setError('')
    portfolioApi
      .list(user.id, editable)
      .then((items) => {
        if (active) setSavedFiles(items)
      })
      .catch((e: Error) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id, editable])
  const save = async (next: typeof files) => {
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
        {loading ? (
          <p role="status">Загрузка достижений…</p>
        ) : (
          !error && !files.length && <p className="empty-state">Достижений пока нет.</p>
        )}
        <div className="achievement-gallery">
          {files.map((f, i) => (
            <div className="portfolio-file achievement-card" key={f.file_id || f.url}>
              {/\.(png|jpe?g|webp|gif|svg)$/i.test(f.name) || f.url.startsWith('data:image/') ? (
                <button
                  type="button"
                  className="achievement-preview"
                  aria-label="Открыть сертификат"
                  onClick={() => setPreview(f)}
                >
                  <CertificateImage key={f.url} url={f.url} name={f.name} />
                </button>
              ) : (
                <div className="achievement-document">Сертификат / документ</div>
              )}
              <FileDownload file={f} className="achievement-download" />
              {editable && (
                <button
                  type="button"
                  className="file-remove"
                  aria-label={`Удалить ${f.name}`}
                  disabled={busy || loading}
                  onClick={async () => {
                    if (!(await confirm(`Удалить файл «${f.name}»?`))) return
                    setBusy(true)
                    try {
                      if (apiRuntime.mode === 'live') {
                        if (!f.file_id) throw new Error('Не найден идентификатор файла')
                        await portfolioApi.remove(f.file_id)
                        await reload()
                      } else await save(files.filter((_, j) => j !== i))
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
            Добавить достижение
            <LocalizedFileInput
              className="input"
              accept="image/png,image/jpeg,image/webp,.pdf"
              multiple
              disabled={busy || loading}
              onChange={async (e) => {
                const selected = Array.from(e.target.files || [])
                e.target.value = ''
                setBusy(true)
                setError('')
                try {
                  const uploaded = await Promise.all(selected.map(uploadFile))
                  if (apiRuntime.mode === 'live') {
                    try {
                      await portfolioApi.add(uploaded)
                    } finally {
                      await reload()
                    }
                  } else await save([...files, ...uploaded])
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
            <button
              className="btn btn-secondary certificate-close"
              autoFocus
              onClick={() => setPreview(null)}
            >
              Закрыть ×
            </button>
            <CertificateImage key={preview.url} url={preview.url} name={preview.name} />
          </>
        )}
      </dialog>
    </section>
  )
}
