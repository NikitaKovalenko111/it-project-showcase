import { isOptionalWebUrl } from '../../utils/validation'
import { apiClient } from '../../api/client'
import { FilePicker } from '../FilePicker'
import { uploadFile } from '../../utils/files'
import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createSubmissionSuccess } from '../../store/actions'
import { FileCode2, Globe, Send, Upload, Video, X } from 'lucide-react'

interface ResultSubmissionModalProps {
  caseId: string
  caseTitle: string
  isOpen: boolean
  onClose: () => void
}

export const ResultSubmissionModal: React.FC<ResultSubmissionModalProps> = ({
  caseId,
  caseTitle,
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)

  const project = useAppSelector(
    (s) => s.cases.casesList.find((c) => c.id === caseId) || s.cases.activeCase,
  )
  const development = !['olympiad', 'internship'].includes(project?.kind || '')
  const [description, setDescription] = useState(
    'Разработан программный модуль вибромониторинга, обучена нейросеть детекции скрытых дефектов подшипников (F1 = 0.92). Подготовлен интерактивный дашборд и REST API.',
  )
  const [repoUrl, setRepoUrl] = useState(currentUser?.studentProfile?.githubUrl || '')
  const [demoUrl, setDemoUrl] = useState('')
  const [presentationFiles, setPresentationFiles] = useState<File[]>([])
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError('')
    try {
      if (development && ![repoUrl, demoUrl].every(isOptionalWebUrl)) {
        throw new Error('Укажите ссылки с http:// или https://.')
      }
      const uploaded = await Promise.all(screenshots.map(uploadFile))
      const presentations = await Promise.all(presentationFiles.map(uploadFile))
      const videos = await Promise.all(videoFiles.map(uploadFile))
      const docs = await Promise.all(docFiles.map(uploadFile))
      const screenshotList = uploaded.map((f) => f.url)

      dispatch(
        createSubmissionSuccess(
          await apiClient.createSubmission({
            caseId,
            authorName: currentUser?.fullName || 'Автор решения',
            description,
            repoUrl: development ? repoUrl.trim() : '',
            demoUrl: development ? demoUrl.trim() || undefined : undefined,
            presentationUrl: presentations[0]?.url,
            videoUrl: videos[0]?.url,
            documentationUrl: docs[0]?.url,
            screenshots: screenshotList,
            attachedFiles: [...uploaded, ...presentations, ...videos, ...docs],
          }),
        ),
      )

      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div>
            <h3>
              {project?.kind === 'olympiad'
                ? 'Решения заданий олимпиады'
                : project?.kind === 'internship'
                  ? 'Итоговый отчёт о стажировке'
                  : 'Представление результатов проекта'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Кейс: <strong>{caseTitle}</strong>
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog__body">
            <div className="form-group">
              <label>Описание решения и достигнутых результатов:*</label>
              <textarea
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Кратко опишите, что было сделано, ключевые архитектурные решения и метрики..."
                required
              />
            </div>

            {development && (
              <>
                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
                >
                  <div className="form-group">
                    <label>Ссылка на исходный код (GitHub / GitLab):*</label>
                    <div className="search-input-wrap">
                      <input
                        type="url"
                        className="input"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Ссылка на работающий сервис / демо-стенд:</label>
                    <div className="search-input-wrap">
                      <input
                        type="url"
                        className="input"
                        value={demoUrl}
                        onChange={(e) => setDemoUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            <FilePicker
              label="Презентация (PDF / PPTX)"
              files={presentationFiles}
              onChange={setPresentationFiles}
              accept=".pdf,.ppt,.pptx"
            />
            <FilePicker
              label="Видеодемонстрация"
              files={videoFiles}
              onChange={setVideoFiles}
              accept="video/*"
            />
            <FilePicker
              label="Техническая документация"
              files={docFiles}
              onChange={setDocFiles}
              accept=".pdf,.doc,.docx,.md,.txt,.zip"
            />
            <div className="form-group">
              <FilePicker
                label="Скриншоты интерфейса"
                files={screenshots}
                onChange={setScreenshots}
                accept="image/*"
              />
              {error && <p role="alert">{error}</p>}
            </div>
          </div>

          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Send size={15} /> Отправить результат на проверку компании
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
