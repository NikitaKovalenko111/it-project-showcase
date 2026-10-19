import React from 'react'
import { Link } from 'react-router-dom'
import { useAppSelector } from '../store'
import { participatesInCase, visibleCasesFor } from '../utils/access'

export const WorkspaceListPage: React.FC = () => {
  const { currentUser } = useAppSelector((s) => s.auth)
  const { casesList, loading, error } = useAppSelector((s) => s.cases)
  const { teamsList } = useAppSelector((s) => s.students)
  const projects = visibleCasesFor(currentUser, casesList).filter((project) =>
    currentUser?.role !== 'student' || participatesInCase(currentUser.id, project, teamsList))
  return <div>
    <div className="page-header"><div className="page-header__content">
      <h1>{currentUser?.role === 'curator' ? 'Мониторинг проектов' : 'Рабочая станция'}</h1>
      <p>Выберите проект, чтобы открыть этапы, результат, команду и обсуждение.</p>
    </div></div>
    {loading ? <p role="status">Загрузка проектов…</p> : error ? <p role="alert">{error}</p> : projects.length === 0 ?
      <div className="card" style={{ padding: 24 }}>Назначенных проектов пока нет. <Link to="/cases">Перейти к кейсам</Link></div> :
      <div className="case-grid">{projects.map((project) => <article className="card" key={project.id}>
        <div className="card__body"><h2 style={{ fontSize: 17 }}>{project.title}</h2><p>{project.companyName}</p>
          <p>Команда: {project.assignedTeamName || project.assignedStudentName || 'Ещё не назначена'}</p>
          <Link className="btn btn-primary btn-sm" to={`/cases/${project.id}/workspace`}>Открыть рабочую станцию</Link>
        </div>
      </article>)}</div>}
  </div>
}
