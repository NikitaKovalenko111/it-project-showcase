import { formatDate } from '../utils/date'
import { PaginatedGrid } from './PaginatedGrid'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { useAppDispatch, useAppSelector } from '../store'
import { updateCaseSuccess } from '../store/actions'
import { UPDATE_STUDENT_PROJECT_SUCCESS } from '../store/types'
import type { CaseProject, ModerationStatus, StudentProject } from '../types/models'
import {
  canModerate,
  matchesSearch,
  publicationLabels,
  publicationStatus,
} from '../utils/publication'
import { CatalogSearch } from './CatalogSearch'

export const PublicationReviewQueue: React.FC<{ kind: 'case' | 'student' }> = ({ kind }) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)
  const cases = useAppSelector((state) => state.cases.casesList)
  const students = useAppSelector((state) => state.studentProjects.projectsList)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('pending')
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const liveStudent = apiRuntime.mode === 'live' && kind === 'student'
  const authorized = canModerate(currentUser)
  const pendingOnly = apiRuntime.mode === 'live' && currentUser?.role !== 'admin'
  const status = pendingOnly ? 'pending' : filter
  const [moderatedStudents, setModeratedStudents] = useState<StudentProject[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!liveStudent || !authorized) return
    let active = true
    setLoading(true)
    setError('')
    apiClient
      .getStudentProjectModeration()
      .then((items) => {
        if (active) setModeratedStudents(items)
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [liveStudent, authorized, currentUser?.id, pendingOnly])

  if (!authorized) return null
  const projects: (CaseProject | StudentProject)[] =
    kind === 'case' ? cases : liveStudent ? moderatedStudents : students
  const filtered = projects.filter(
    (project) =>
      (status === 'all' || publicationStatus(project) === status) &&
      matchesSearch(
        search,
        project.title,
        'companyName' in project ? project.companyName : project.authorName,
        project.direction,
      ),
  )
  const decide = async (project: CaseProject | StudentProject, status: ModerationStatus) => {
    setError('')
    setBusy(project.id)
    try {
      const updated = await apiClient.moderatePublication(
        kind,
        project.id,
        status,
        comments[project.id] || '',
      )
      if (kind === 'case') dispatch(updateCaseSuccess(updated as CaseProject))
      else {
        if (liveStudent)
          setModeratedStudents((items) =>
            items.map((item) => (item.id === updated.id ? (updated as StudentProject) : item)),
          )
        dispatch({ type: UPDATE_STUDENT_PROJECT_SUCCESS, payload: { project: updated } })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить решение')
    } finally {
      setBusy(null)
    }
  }
  if (loading) return <p role="status">Загружаем очередь модерации…</p>
  return (
    <section>
      <CatalogSearch
        value={search}
        onChange={setSearch}
        label={kind === 'case' ? 'Поиск кейсов на модерации' : 'Поиск студенческих публикаций'}
      />
      {!pendingOnly && (
        <label className="review-status-filter">
          Статус публикации{' '}
          <select
            className="select"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Все публикации</option>
            {Object.entries(publicationLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <p aria-live="polite">Найдено публикаций: {filtered.length}</p>
      <div className="review-list">
        {
          <PaginatedGrid
            className="paginated-stack"
            paginationKey={kind === 'case' ? 'casesReview' : 'projectsReview'}
          >
            {filtered.map((project) => (
              <article className="card" key={project.id}>
                <div className="card__body">
                  <div className="action-row">
                    <span className={`badge publication-${publicationStatus(project)}`}>
                      {publicationLabels[publicationStatus(project)]}
                    </span>
                    <span className="badge badge-direction">{project.direction}</span>
                  </div>
                  <h2 className="case-card__title">
                    <Link to={`/${kind === 'case' ? 'cases' : 'student-projects'}/${project.id}`}>
                      {project.title}
                    </Link>
                  </h2>
                  <p>{'companyName' in project ? project.companyName : project.authorName}</p>
                  <p>{project.shortDescription}</p>
                  {'deadlineDate' in project && (
                    <p>
                      Срок: {formatDate(project.deadlineDate)} · Вознаграждение:{' '}
                      {project.rewardDescription || 'Не указано'}
                    </p>
                  )}
                  <Link
                    className="btn btn-secondary btn-sm"
                    to={`/${kind === 'case' ? 'cases' : 'student-projects'}/${project.id}`}
                  >
                    Прочитать описание и условия
                  </Link>
                  {project.moderationComment && (
                    <p>Предыдущее решение: {project.moderationComment}</p>
                  )}
                  <>
                    <label className="review-comment">
                      Комментарий к решению
                      <textarea
                        className="textarea"
                        value={comments[project.id] || ''}
                        onChange={(event) =>
                          setComments({ ...comments, [project.id]: event.target.value })
                        }
                        placeholder="Для отклонения, доработки или скрытия укажите причину"
                      />
                    </label>
                    <div className="action-row">
                      {(liveStudent
                        ? publicationStatus(project) === 'pending'
                        : publicationStatus(project) !== 'approved') && (
                        <button
                          className="btn btn-success btn-sm"
                          disabled={!!busy}
                          onClick={() => decide(project, 'approved')}
                        >
                          Одобрить и опубликовать
                        </button>
                      )}
                      {(liveStudent
                        ? publicationStatus(project) === 'pending'
                        : publicationStatus(project) !== 'approved') && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!!busy || !comments[project.id]?.trim()}
                          onClick={() => decide(project, 'revision')}
                        >
                          На доработку
                        </button>
                      )}
                      {!liveStudent && publicationStatus(project) !== 'rejected' && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={!!busy || !comments[project.id]?.trim()}
                          onClick={() => decide(project, 'rejected')}
                        >
                          Отклонить
                        </button>
                      )}
                      {!pendingOnly && publicationStatus(project) === 'approved' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!!busy}
                          onClick={() => decide(project, 'hidden')}
                        >
                          Скрыть публикацию
                        </button>
                      )}
                    </div>
                  </>
                </div>
              </article>
            ))}
          </PaginatedGrid>
        }
      </div>
      {!filtered.length && (
        <div className="card empty-state">Публикаций с такими условиями нет.</div>
      )}
    </section>
  )
}
