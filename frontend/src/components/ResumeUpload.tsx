import { LocalizedFileInput } from './LocalizedFileInput'
import React, { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { uploadFile } from '../utils/files'
import { FileDownload } from './FileDownload'
import type { StudentProfile } from '../types/models'
export const ResumeUpload: React.FC<{ editable?: boolean }> = ({ editable = true }) => {
  const [resume, setResume] = useState<StudentProfile['resume']>(),
    [selected, setSelected] = useState<File | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [publicResume, setPublicResume] = useState(false)
  useEffect(() => {
    let active = true
    apiClient
      .getResume()
      .then((file) => {
        if (active) {
          setResume(file)
          setPublicResume(!!file?.public)
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  return (
    <section className="resume-upload">
      <h3>Резюме (CV)</h3>
      {loading && <p role="status">Загружаем резюме…</p>}
      {resume && <FileDownload file={resume} />}
      {!loading && !resume && !error && <p>Резюме пока не загружено.</p>}
      {editable && (
        <>
          <label>
            Выбрать резюме (PDF, DOC или DOCX)
            <LocalizedFileInput
              className="input"
              accept=".pdf,.doc,.docx"
              disabled={busy}
              onChange={(e) => {
                setError('')
                setNotice('')
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                if (!/\.(pdf|docx?)$/i.test(file.name)) {
                  setError('Выберите PDF, DOC или DOCX')
                  setSelected(null)
                  return
                }
                setSelected(file)
              }}
            />
          </label>
          {selected && <p>{selected.name}</p>}
          <label className="resume-visibility">
            <input
              type="checkbox"
              checked={publicResume}
              disabled={busy || loading}
              onChange={(event) => setPublicResume(event.target.checked)}
            />
            Показывать резюме посетителям профиля
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={
              busy || loading || (!selected && (!resume || publicResume === !!resume.public))
            }
            onClick={async () => {
              if (!selected && !resume) return
              setBusy(true)
              setError('')
              try {
                const file = {
                  ...(selected ? await uploadFile(selected) : resume!),
                  public: publicResume,
                }
                await apiClient.saveResume(file)
                setResume(file)
                setSelected(null)
                setNotice('Резюме сохранено')
              } catch (e) {
                setError((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Сохраняем…' : 'Сохранить резюме'}
          </button>
          {notice && <p role="status">{notice}</p>}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
