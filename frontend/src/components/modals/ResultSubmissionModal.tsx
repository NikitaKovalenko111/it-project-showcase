import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createSubmissionRequest } from '../../store/actions'
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

  const [description, setDescription] = useState(
    'Разработан программный модуль вибромониторинга, обучена нейросеть детекции скрытых дефектов подшипников (F1 = 0.92). Подготовлен интерактивный дашборд и REST API.'
  )
  const [repoUrl, setRepoUrl] = useState('https://github.com/ivan-petrov-uust/vibration-predictor-uust')
  const [demoUrl, setDemoUrl] = useState('https://vibration-demo.uust.space')
  const [presentationUrl, setPresentationUrl] = useState('https://docs.google.com/presentation/d/uust-vibration')
  const [videoUrl, setVideoUrl] = useState('https://rutube.ru/video/uust-compressor-demo')
  const [docUrl, setDocUrl] = useState('https://github.com/ivan-petrov-uust/vibration-predictor-uust/wiki')
  const [screenshots, setScreenshots] = useState(
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800, https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800'
  )

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const screenshotList = screenshots
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    dispatch(
      createSubmissionRequest({
        caseId,
        authorName: currentUser?.fullName || 'Иван Петров (Студент)',
        description,
        repoUrl,
        demoUrl: demoUrl || undefined,
        presentationUrl: presentationUrl || undefined,
        videoUrl: videoUrl || undefined,
        documentationUrl: docUrl || undefined,
        screenshots: screenshotList,
        attachedFiles: [
          { name: 'Model_Weights_V1.onnx', url: 'https://example.com/model.onnx' },
          { name: 'Architecture_Documentation.pdf', url: 'https://example.com/arch.pdf' },
        ],
      })
    )

    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div>
            <h3>Представление результатов выполнения проекта (п. 5.11 ТЗ)</h3>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Ссылка на исходный код (GitHub / GitLab):*</label>
                <div className="search-input-wrap">
                  <FileCode2 size={16} className="search-icon" />
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
                  <Globe size={16} className="search-icon" />
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Ссылка на презентацию (PDF / Slides):</label>
                <input
                  type="url"
                  className="input"
                  value={presentationUrl}
                  onChange={(e) => setPresentationUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label>Ссылка на видеодемонстрацию / скринкаст:</label>
                <div className="search-input-wrap">
                  <Video size={16} className="search-icon" />
                  <input
                    type="url"
                    className="input"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://rutube.ru/..."
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Ссылка на техническую документацию / Wiki:</label>
              <input
                type="url"
                className="input"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="form-group">
              <label>Ссылки на скриншоты интерфейса (через запятую):</label>
              <input
                type="text"
                className="input"
                value={screenshots}
                onChange={(e) => setScreenshots(e.target.value)}
                placeholder="https://image1.png, https://image2.png"
              />
            </div>
          </div>

          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              <Send size={15} /> Отправить результат на проверку компании
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
