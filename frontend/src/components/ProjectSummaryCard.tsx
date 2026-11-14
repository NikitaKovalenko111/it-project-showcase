import { ExpandableText } from './ExpandableText'
import { complexityBadge } from '../utils/publication'
import { formatDate } from '../utils/date'
import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Trash2, Users } from 'lucide-react'
import type { CaseProject } from '../types/models'
import {
  caseStatusLabels,
  isPublished,
  publicationLabels,
  publicationStatus,
} from '../utils/publication'

export const ProjectSummaryCard: React.FC<{
  project: CaseProject
  workspace?: boolean
  catalog?: boolean
  onRemove?: () => void
  applicationStatus?: string
  teamName?: string
  extraAction?: React.ReactNode
}> = ({ project, workspace, catalog, onRemove, applicationStatus, teamName, extraAction }) => (
  <article className="card card-hover case-card project-summary-card">
    {catalog && <div className="case-card__top-accent" />}
    {onRemove && (
      <button
        className="case-card__fav-btn favorited"
        onClick={onRemove}
        aria-label={`Удалить из избранного: ${project.title}`}
        title="Удалить из избранного"
      >
        <Trash2 size={15} />
      </button>
    )}
    <div className="card__body">
      <div className="case-card__company">
        {project.companyLogo && <img src={project.companyLogo} alt="" />}
        <div>
          <span className="company-title">{project.companyName}</span>
          {catalog && <div className="company-sub">Индустриальный партнёр</div>}
        </div>
      </div>
      <Link to={`/cases/${project.id}`}>
        <h2 className="case-card__title">{project.title}</h2>
      </Link>
      <ExpandableText compact text={project.shortDescription} />
      <div className="case-card__tags">
        <span className="badge badge-direction">
          {
            { case: 'Кейс', hackathon: 'Хакатон', olympiad: 'Олимпиада', internship: 'Стажировка' }[
              project.kind || 'case'
            ]
          }
        </span>
        {applicationStatus && (
          <span className="badge badge-direction">Заявка: {applicationStatus}</span>
        )}
        {project.direction && <span className="badge badge-direction">{project.direction}</span>}
        <span className={`badge ${complexityBadge(project.complexity)}`}>
          Уровень: {project.complexity.toLowerCase()}
        </span>
        <span className={`badge publication-${publicationStatus(project)}`}>
          {project.status === 'draft' || isPublished(project)
            ? caseStatusLabels[project.status]
            : publicationLabels[publicationStatus(project)]}
        </span>
      </div>
      <div className="case-card__meta-grid">
        <div className="meta-item">
          <Calendar size={13} />
          <span>
            Дедлайн: <strong>{formatDate(project.deadlineDate)}</strong>
          </span>
        </div>
        <div className="meta-item">
          <Users size={13} />
          <span>
            Команда:{' '}
            <strong>
              {teamName ||
                project.assignedTeamName ||
                project.assignedStudentName ||
                (project.teamSize.min === project.teamSize.max
                  ? `${project.teamSize.min} чел.`
                  : `${project.teamSize.min}–${project.teamSize.max} чел.`)}
            </strong>
          </span>
        </div>
      </div>
      {catalog && !!project.recommendedTech.length && (
        <div className="case-card__technologies">
          {project.recommendedTech.slice(0, 4).map((tech) => (
            <span className="tech-tag" key={tech}>
              {tech}
            </span>
          ))}
        </div>
      )}
    </div>
    <div className="card__footer">
      {extraAction}
      <span className="project-summary-card__count">
        Заявок: <strong>{project.applicationsCount}</strong>
      </span>
      <Link
        to={workspace ? `/cases/${project.id}/workspace` : `/cases/${project.id}`}
        className="btn btn-primary btn-sm"
      >
        {workspace ? 'Открыть проект' : 'Перейти к кейсу'}
      </Link>
    </div>
  </article>
)
