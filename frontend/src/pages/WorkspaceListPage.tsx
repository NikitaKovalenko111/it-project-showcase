import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppSelector } from '../store'
import { participatesInCase, visibleCasesFor } from '../utils/access'
import { isPublished, matchesSearch } from '../utils/publication'
import { CatalogSearch } from '../components/CatalogSearch'
import { ProjectSummaryCard } from '../components/ProjectSummaryCard'

export const WorkspaceListPage: React.FC = () => {
  const { currentUser } = useAppSelector((state) => state.auth)
  const { casesList, loading, error } = useAppSelector((state) => state.cases)
  const { teamsList } = useAppSelector((state) => state.students)
  const [search, setSearch] = useState('')
  const projects = visibleCasesFor(currentUser, casesList).filter((project) => isPublished(project)
    && (currentUser?.role !== 'student' || participatesInCase(currentUser.id, project, teamsList))
    && matchesSearch(search, project.title, project.companyName, project.direction, project.assignedTeamName, project.assignedStudentName, project.recommendedTech))
  return <div>
    <div className="page-header"><div className="page-header__content">
      <h1>{currentUser?.role === 'curator' ? 'Мониторинг кейсов' : 'Рабочая станция'}</h1>
      <p>Выберите проект, чтобы открыть этапы, результат, команду и обсуждение.</p>
    </div></div>
    <CatalogSearch value={search} onChange={setSearch} label="Поиск по проекту, компании, команде или направлению" />
    {loading ? <p role="status">Загрузка проектов…</p> : error ? <p role="alert">{error}</p> : <>
      <p aria-live="polite">Найдено проектов: {projects.length}</p>
      <div className="case-grid">{projects.map((project) => <ProjectSummaryCard key={project.id} project={project} workspace />)}</div>
      {!projects.length && <div className="card empty-state"><p>{search ? 'По вашему запросу ничего не найдено.' : 'Доступных проектов пока нет.'}</p><Link to="/cases">Перейти к кейсам</Link></div>}
    </>}
  </div>
}
