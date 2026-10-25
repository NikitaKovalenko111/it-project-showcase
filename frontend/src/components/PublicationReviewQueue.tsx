import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAppDispatch, useAppSelector } from '../store'
import { updateCaseSuccess } from '../store/actions'
import { UPDATE_STUDENT_PROJECT_SUCCESS } from '../store/types'
import type { CaseProject, ModerationStatus, StudentProject } from '../types/models'
import { canModerate, matchesSearch, publicationLabels, publicationStatus } from '../utils/publication'
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
  if (!canModerate(currentUser)) return null
  const projects: (CaseProject | StudentProject)[] = kind === 'case' ? cases : students
  const filtered = projects.filter((project) => (filter === 'all' || publicationStatus(project) === filter)
    && matchesSearch(search, project.title, 'companyName' in project ? project.companyName : project.authorName, project.direction))
  const decide = async (project: CaseProject | StudentProject, status: ModerationStatus) => {
    setError('')
    setBusy(project.id)
    try {
      const updated = await apiClient.moderatePublication(kind, project.id, status, comments[project.id] || '')
      if (kind === 'case') dispatch(updateCaseSuccess(updated as CaseProject))
      else dispatch({ type: UPDATE_STUDENT_PROJECT_SUCCESS, payload: { project: updated } })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить решение') }
    finally { setBusy(null) }
  }
  return <section>
    <CatalogSearch value={search} onChange={setSearch} label={kind === 'case' ? 'Поиск кейсов на модерации' : 'Поиск студенческих публикаций'} />
    <label className="review-status-filter">Статус публикации <select className="select" value={filter} onChange={(event) => setFilter(event.target.value)}>
      <option value="all">Все публикации</option>{Object.entries(publicationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}
    <p aria-live="polite">Найдено публикаций: {filtered.length}</p>
    <div className="review-list">{filtered.map((project) => <article className="card" key={project.id}>
      <div className="card__body">
        <div className="action-row"><span className={`badge publication-${publicationStatus(project)}`}>{publicationLabels[publicationStatus(project)]}</span><span className="badge badge-direction">{project.direction}</span></div>
        <h2 className="case-card__title"><Link to={`/${kind === 'case' ? 'cases' : 'student-projects'}/${project.id}`}>{project.title}</Link></h2>
        <p>{'companyName' in project ? project.companyName : project.authorName}</p>
        <p>{project.shortDescription}</p>
        {'deadlineDate' in project && <p>Срок: {new Date(project.deadlineDate).toLocaleDateString('ru-RU')} · Вознаграждение: {project.rewardDescription || 'Не указано'}</p>}
        <Link className="btn btn-secondary btn-sm" to={`/${kind === 'case' ? 'cases' : 'student-projects'}/${project.id}`}>Прочитать описание и условия</Link>
        {project.moderationComment && <p>Предыдущее решение: {project.moderationComment}</p>}
        <label className="review-comment">Комментарий к решению<textarea className="textarea" value={comments[project.id] || ''} onChange={(event) => setComments({ ...comments, [project.id]: event.target.value })} placeholder="Для отклонения, доработки или скрытия укажите причину" /></label>
        <div className="action-row">
          {publicationStatus(project) !== 'approved' && <button className="btn btn-success btn-sm" disabled={!!busy} onClick={() => decide(project, 'approved')}>Одобрить и опубликовать</button>}
          {publicationStatus(project) !== 'approved' && <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => decide(project, 'revision')}>На доработку</button>}
          {publicationStatus(project) !== 'rejected' && <button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => decide(project, 'rejected')}>Отклонить</button>}
          {publicationStatus(project) === 'approved' && <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => decide(project, 'hidden')}>Скрыть публикацию</button>}
        </div>
      </div>
    </article>)}</div>
    {!filtered.length && <div className="card empty-state">Публикаций с такими условиями нет.</div>}
  </section>
}
