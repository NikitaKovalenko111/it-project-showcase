import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Trash2, Users } from 'lucide-react'
import type { CaseProject } from '../types/models'
import { caseStatusLabels, isPublished, publicationLabels, publicationStatus } from '../utils/publication'

export const ProjectSummaryCard: React.FC<{
  project: CaseProject
  workspace?: boolean
  onRemove?: () => void
  applicationStatus?: string
}> = ({ project, workspace, onRemove, applicationStatus }) => (
  <article className="card card-hover case-card project-summary-card">
    {onRemove && <button className="case-card__fav-btn favorited" onClick={onRemove} aria-label={`Удалить из избранного: ${project.title}`} title="Удалить из избранного"><Trash2 size={15} /></button>}
    <div className="card__body">
      <div className="case-card__company">
        {project.companyLogo && <img src={project.companyLogo} alt="" />}
        <span className="company-title">{project.companyName}</span>
      </div>
      <Link to={`/cases/${project.id}`}><h2 className="case-card__title">{project.title}</h2></Link>
      <p className="case-card__desc">{project.shortDescription}</p>
      <div className="case-card__tags">
        {applicationStatus && <span className="badge badge-direction">Заявка: {applicationStatus}</span>}
        <span className="badge badge-direction">{project.direction}</span>
        <span className="badge badge-complexity-medium">Уровень: {project.complexity.toLowerCase()}</span>
        <span className={`badge publication-${publicationStatus(project)}`}>{isPublished(project) ? caseStatusLabels[project.status] : publicationLabels[publicationStatus(project)]}</span>
      </div>
      <div className="case-card__meta-grid">
        <div className="meta-item"><Calendar size={13} /><span>Дедлайн: <strong>{new Date(project.deadlineDate).toLocaleDateString('ru-RU')}</strong></span></div>
        <div className="meta-item"><Users size={13} /><span>Команда: <strong>{project.assignedTeamName || project.assignedStudentName || `${project.teamSize.min}–${project.teamSize.max} чел.`}</strong></span></div>
      </div>
    </div>
    <div className="card__footer">
      <span className="project-summary-card__count">Заявок: <strong>{project.applicationsCount}</strong></span>
      <Link to={workspace ? `/cases/${project.id}/workspace` : `/cases/${project.id}`} className="btn btn-primary btn-sm">{workspace ? 'Открыть рабочую станцию' : 'Перейти к кейсу'}</Link>
    </div>
  </article>
)
