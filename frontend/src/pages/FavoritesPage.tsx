import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCasesRequest, fetchFavoritesRequest, toggleFavoriteRequest } from '../store/actions'
import { ProjectSummaryCard } from '../components/ProjectSummaryCard'
import { CatalogSearch } from '../components/CatalogSearch'
import { matchesSearch } from '../utils/publication'

const statusLabels = { pending: 'На рассмотрении', interview: 'Назначено интервью', accepted: 'Принят в команду', rejected: 'Отклонена', need_info: 'Нужны уточнения' }

export const FavoritesPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { casesList, favorites, loading, error } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'favorites' | 'applications'>('favorites')
  useEffect(() => { dispatch(fetchCasesRequest()); dispatch(fetchFavoritesRequest()) }, [dispatch])
  const applications = applicationsList.filter((app) => app.studentId === currentUser?.id)
  const ids = tab === 'favorites' ? favorites : applications.map((app) => app.caseId)
  const projects = casesList.filter((project) => ids.includes(project.id) && matchesSearch(search, project.title, project.companyName, project.direction, project.assignedTeamName, project.recommendedTech))
  return <div>
    <div className="page-header"><div className="page-header__content"><h1>Заявки и избранное</h1><p>Статусы ваших откликов, сохраненные кейсы и сроки проектов.</p></div></div>
    <div className="tabs-bar">
      <button className={`tab-btn ${tab === 'favorites' ? 'active' : ''}`} onClick={() => setTab('favorites')}>Избранное ({favorites.length})</button>
      <button className={`tab-btn ${tab === 'applications' ? 'active' : ''}`} onClick={() => setTab('applications')}>Мои заявки ({applications.length})</button>
    </div>
    <CatalogSearch value={search} onChange={setSearch} label="Поиск по названию, компании или направлению" />
    {loading ? <p role="status">Загрузка…</p> : error ? <p role="alert">{error}</p> : <>
      <p aria-live="polite">Найдено проектов: {projects.length}</p>
      <div className="case-grid">{projects.map((project) => {
        const app = applications.find((item) => item.caseId === project.id)
        return <ProjectSummaryCard key={project.id} project={project} applicationStatus={tab === 'applications' && app ? statusLabels[app.status] : undefined} onRemove={tab === 'favorites' ? () => dispatch(toggleFavoriteRequest(project.id)) : undefined} />
      })}</div>
      {!projects.length && <div className="card empty-state"><p>{search ? 'По вашему запросу ничего не найдено.' : tab === 'favorites' ? 'Сохраненных кейсов пока нет.' : 'Вы еще не подали заявки.'}</p><Link to="/cases" className="btn btn-primary btn-sm">Перейти к витрине</Link></div>}
    </>}
  </div>
}
