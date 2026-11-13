import { FileDownload } from './FileDownload'
import React, { useEffect, useState } from 'react'
import { Award, Clock, FileCheck2, FileText, Image, Video, Upload, Users } from 'lucide-react'
import { CaseProject } from '../types/models'
import { Execution } from '../types/execution'
import { useAppSelector } from '../store'
import { communityApi } from '../api/community'
import { FilePicker } from './FilePicker'
import { uploadResultFile } from '../utils/files'
import { ExecutionStages } from './ExecutionStages'
import { ExecutionEvaluation } from './ExecutionEvaluation'
import { TeamMembers } from './TeamMembers'
import { legacyCriteria } from '../utils/evaluation'
import { EventRoundWork } from './EventRoundWork'
import { ExecutionComments } from './ExecutionComments'
import { apiRuntime } from '../api/runtime'
import { axiosInstance } from '../api/http'
import { isOptionalWebUrl } from '../utils/validation'

type FileMetadata = {
  file_id: string
  original_name: string
  mime_type: string
  size_bytes: number
}

export const ExecutionDetail: React.FC<{
  project: CaseProject
  entry: Execution
  manager: boolean
  finished: boolean
  section?: string
  onChange: () => Promise<void>
  onBack?: () => void
}> = ({ project, entry, manager, finished, section, onChange, onBack }) => {
  const user = useAppSelector((s) => s.auth.currentUser),
    { studentsList, teamsList } = useAppSelector((s) => s.students)
  const participant = user?.role === 'student' && entry.members.some((m) => m.id === user.id),
    olympiad = project.kind === 'olympiad'
  const live = apiRuntime.mode === 'live'
  const liveOlympiad = live && olympiad
  const canGrade =
    manager &&
    !finished &&
    !!entry.submission &&
    (!live || (user?.role === 'company' && !entry.evaluation))
  const canSubmitResult =
    participant && !finished && !entry.evaluation && entry.canSubmitResult !== false
  const curated = apiRuntime.mode === 'live' && user?.role === 'curator'
  const [tab, setTab] = useState('stages'),
    [grading, setGrading] = useState(false),
    [description, setDescription] = useState(entry.submission?.description || '')
  const [demoUrl, setDemoUrl] = useState(entry.submission?.demoUrl || '')
  const [metadata, setMetadata] = useState<{ submissionId: string; files: FileMetadata[] }>()
  const [images, setImages] = useState<File[]>([])
  const [videos, setVideos] = useState<File[]>([])
  const [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false)
  const active = section || tab,
    team = teamsList.find((t) => t.id === entry.teamId)
  const submissionId = entry.submission?.id
  const hasFiles = !!entry.submission?.attachedFiles.length
  const ownSubmission = !live || entry.submission?.studentId === user?.id
  useEffect(() => {
    if (!live || !manager || active !== 'submission' || liveOlympiad || !submissionId || !hasFiles)
      return
    let mounted = true
    axiosInstance
      .get<{ files: FileMetadata[] }>(`/submissions/${submissionId}/review-details`)
      .then(({ data }) => {
        if (mounted) setMetadata({ submissionId, files: data.files || [] })
      })
      .catch(() => {
        // The files are still downloadable when review metadata is unavailable.
      })
    return () => {
      mounted = false
    }
  }, [live, manager, active, liveOlympiad, submissionId, hasFiles])
  return (
    <section className="execution-detail">
      {!participant && (
        <div className="execution-detail-heading">
          <div>
            {onBack && (
              <button className="btn btn-secondary btn-sm" onClick={onBack}>
                ← К списку участников
              </button>
            )}
            <h2>{entry.name}</h2>
          </div>
          {!liveOlympiad && canGrade && (
            <button
              className="btn btn-accent btn-sm"
              onClick={() => {
                setTab('submission')
                setGrading(true)
              }}
            >
              <Award size={16} /> {entry.evaluation ? 'Изменить оценку' : 'Оценить решение'}
            </button>
          )}
        </div>
      )}
      {!section && (
        <nav className="tabs-bar" aria-label="Выполнение участника">
          {[
            ['stages', 'Контрольные точки', Clock],
            ...(!curated ? [['submission', 'Результат и оценка', FileCheck2]] : []),
            ['members', entry.teamId ? 'Проектная команда' : 'Участник', Users],
          ].map(([value, label, Icon]) => (
            <button
              key={value as string}
              className={`tab-btn ${active === value ? 'active' : ''}`}
              onClick={() => setTab(value as string)}
            >
              {React.createElement(Icon as typeof Clock, { size: 16 })}
              {label as string}
            </button>
          ))}
        </nav>
      )}
      {active === 'stages' && (
        <ExecutionStages
          entry={entry}
          manager={manager}
          participant={participant}
          finished={finished}
          onChange={onChange}
        />
      )}
      {active === 'stages' && apiRuntime.mode === 'live' && (
        <ExecutionComments executionId={entry.id} />
      )}
      {active === 'members' && (
        <section className="execution-members">
          <h2>{entry.teamId ? entry.name : 'Участник'}</h2>
          <TeamMembers members={entry.members} leaderId={team?.leaderId} students={studentsList} />
        </section>
      )}
      {active === 'submission' && liveOlympiad && (
        <EventRoundWork
          caseId={project.id}
          executionId={entry.id}
          participant={participant}
          manager={manager}
        />
      )}
      {active === 'submission' && !liveOlympiad && (
        <div className="execution-result-grid">
          <section className="card result-card">
            <div className="card__header">
              <h3>{olympiad ? 'Решения заданий' : 'Результат выполнения'}</h3>
              <FileCheck2 size={20} />
            </div>
            <div className="card__body">
              {entry.submission ? (
                <>
                  <p className="preserve-text">{entry.submission.description}</p>
                  {entry.submission.demoUrl && isOptionalWebUrl(entry.submission.demoUrl) && (
                    <a href={entry.submission.demoUrl} target="_blank" rel="noreferrer">
                      Видео или демонстрация
                    </a>
                  )}
                  {!!entry.submission.attachedFiles.length && (
                    <section className="result-attachments">
                      <h4>Файлы результата</h4>
                      <ul>
                        {entry.submission.attachedFiles.map((attachment, i) => {
                          const details =
                            metadata?.submissionId === submissionId
                              ? metadata?.files.find((file) => file.file_id === attachment.file_id)
                              : undefined
                          const file = details
                            ? {
                                ...attachment,
                                name: details.original_name,
                                mimeType: details.mime_type,
                                size: `${Math.ceil(details.size_bytes / 1024)} КБ`,
                              }
                            : attachment
                          const Icon =
                            file.mimeType?.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name)
                              ? Video
                              : file.mimeType?.startsWith('image/') ||
                                  file.kind === 'screenshot' ||
                                  /\.(png|jpe?g|webp)$/i.test(file.name)
                                ? Image
                                : FileText
                          return (
                            <li key={file.file_id || i}>
                              <Icon size={19} aria-hidden="true" />
                              <FileDownload file={file} className="result-file-link" />
                              {file.size && <small>{file.size}</small>}
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )}
                </>
              ) : (
                <p className="empty-state">
                  {participant ? 'Вы ещё не отправили результат.' : 'Участник ещё не сдал работу.'}
                </p>
              )}
              {participant &&
                entry.submission &&
                !finished &&
                !entry.evaluation &&
                !canSubmitResult && (
                  <p className="inline-notice">
                    Новая версия доступна после возврата работы на доработку.
                  </p>
                )}
              {saved && (
                <p className="inline-notice" role="status">
                  Результат отправлен на проверку.
                </p>
              )}
              {canSubmitResult && (
                <form
                  className="execution-form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (busy) return
                    setBusy(true)
                    setError('')
                    setSaved(false)
                    try {
                      if (!description.trim()) throw new Error('Добавьте описание решения.')
                      if (!isOptionalWebUrl(demoUrl))
                        throw new Error('Введите ссылку на видео с http:// или https://.')
                      const current = ownSubmission ? entry.submission?.attachedFiles || [] : []
                      if (current.length + images.length + videos.length + files.length > 30)
                        throw new Error('К результату можно приложить не больше 30 файлов.')
                      const attachments = await Promise.all([
                        ...images.map(async (file) => ({
                          ...(await uploadResultFile(file)),
                          kind: 'screenshot',
                        })),
                        ...[...videos, ...files].map(uploadResultFile),
                      ])
                      await communityApi.submitExecution(
                        entry.id,
                        description.trim(),
                        [...current, ...attachments],
                        demoUrl.trim() || undefined,
                      )
                      await onChange()
                      setFiles([])
                      setImages([])
                      setVideos([])
                      setSaved(true)
                    } catch (e) {
                      setError((e as Error).message)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <label>
                    {olympiad ? 'Решения и пояснения' : 'Описание решения'}
                    <textarea
                      className="textarea"
                      required
                      maxLength={20000}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label>
                    Ссылка на видео или демонстрацию
                    <input
                      className="input"
                      type="url"
                      placeholder="https://"
                      value={demoUrl}
                      onChange={(event) => setDemoUrl(event.target.value)}
                    />
                  </label>
                  {!ownSubmission && hasFiles && (
                    <p className="inline-notice">
                      Для новой версии загрузите заново нужные файлы из работы другого участника.
                    </p>
                  )}
                  <div className="result-upload-fields">
                    <FilePicker
                      label="Фото и скриншоты · до 2 МБ"
                      files={images}
                      onChange={setImages}
                      accept="image/png,image/jpeg,image/webp"
                    />
                    {!live && (
                      <FilePicker
                        label="Видео MP4 и WebM · до 20 МБ"
                        files={videos}
                        onChange={setVideos}
                        accept="video/mp4,video/webm,.mp4,.webm"
                      />
                    )}
                    <FilePicker
                      label="Документы и архивы · до 2 МБ"
                      files={files}
                      onChange={setFiles}
                      accept=".pdf,.txt,.zip"
                    />
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={busy}>
                    <Upload size={16} />{' '}
                    {entry.submission ? 'Обновить результат' : 'Сдать результат'}
                  </button>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>
          </section>
          <section className="card result-card">
            <div className="card__header">
              <h3>Оценка и рецензия</h3>
              <Award size={20} />
            </div>
            <div className="card__body">
              {entry.evaluation ? (
                <>
                  <div className="score-banner">
                    <div>
                      <small>Итоговая оценка</small>
                      <strong>
                        {entry.evaluation.totalScore} / {entry.evaluation.maxScore}
                      </strong>
                    </div>
                    <Award size={36} />
                  </div>
                  <dl className="score-breakdown">
                    {Object.entries(entry.evaluation.scores).map(([id, score]) => (
                      <div key={id}>
                        <dt>
                          {(project.olympiadTasks || []).find((c) => c.id === id)?.title ||
                            (project.evaluationCriteria || legacyCriteria).find((c) => c.id === id)
                              ?.label ||
                            id}
                        </dt>
                        <dd>{score}</dd>
                      </div>
                    ))}
                  </dl>
                  <blockquote className="stage-review">
                    <p className="preserve-text">{entry.evaluation.feedback}</p>
                    <small>{entry.evaluation.evaluatorName}</small>
                  </blockquote>
                </>
              ) : (
                <p className="empty-state">
                  {entry.submission
                    ? 'Результат ожидает проверки.'
                    : 'Оценка появится после сдачи и проверки результата.'}
                </p>
              )}
              {canGrade && (
                <button className="btn btn-accent btn-sm" onClick={() => setGrading(true)}>
                  <Award size={16} /> {entry.evaluation ? 'Изменить оценку' : 'Оценить решение'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {grading && canGrade && (
        <ExecutionEvaluation
          project={project}
          entry={entry}
          onClose={() => setGrading(false)}
          onSaved={onChange}
        />
      )}
    </section>
  )
}
