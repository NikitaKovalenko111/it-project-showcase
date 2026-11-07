import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { useConfirm } from '../components/ConfirmProvider'
import { PaginatedGrid } from '../components/PaginatedGrid'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchApplicationsRequest, fetchCasesRequest, fetchFavoritesRequest, toggleFavoriteRequest } from '../store/actions'
import { ProjectSummaryCard } from '../components/ProjectSummaryCard'
import { CatalogSearch } from '../components/CatalogSearch'
import { matchesSearch } from '../utils/publication'

const statusLabels = { pending: 'На рассмотрении', interview: 'Назначено интервью', accepted: 'Заявка принята', rejected: 'Отклонена', need_info: 'Нужны уточнения' }

export const FavoritesPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const confirm=useConfirm()
  const [consentNotice,setConsentNotice]=useState('')
  const [consenting,setConsenting]=useState('')
  const { casesList, favorites, loading, error } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'favorites' | 'applications'>('favorites')
  useEffect(() => { dispatch(fetchCasesRequest()); dispatch(fetchFavoritesRequest()) }, [dispatch])
  const applications = applicationsList.filter((app) => app.studentId === currentUser?.id || apiRuntime.mode==='live'&&app.teamId)
  const ids = tab === 'favorites' ? favorites : applications.map((app) => app.caseId)
  const projects = casesList.filter((project) => ids.includes(project.id) && matchesSearch(search, project.title, project.companyName, project.direction, project.assignedTeamName, project.recommendedTech))
  return <div>
    <div className="page-header"><div className="page-header__content"><h1>Заявки и избранное</h1><p>Статусы ваших откликов, сохраненные кейсы и сроки проектов.</p></div></div>
    <div className="tabs-bar">
      <button className={`tab-btn ${tab === 'favorites' ? 'active' : ''}`} onClick={() => setTab('favorites')}>Избранное ({favorites.length})</button>
      <button className={`tab-btn ${tab === 'applications' ? 'active' : ''}`} onClick={() => setTab('applications')}>Мои заявки ({applications.length})</button>
    </div>
    {consentNotice&&<p role="status">{consentNotice}</p>}
    <CatalogSearch value={search} onChange={setSearch} label="Поиск по названию, компании или направлению" />
    {loading ? <p role="status">Загрузка…</p> : error ? <p role="alert">{error}</p> : <>
      <p aria-live="polite">Найдено проектов: {projects.length}</p>
      <PaginatedGrid>{projects.map((project) => {
        const app = applications.find((item) => item.caseId === project.id)
        return <div key={project.id}>
          <ProjectSummaryCard project={project} applicationStatus={tab==='applications'&&app?(app.consentPending?'Ожидаются согласия команды':statusLabels[app.status]):undefined} onRemove={tab==='favorites'?()=>dispatch(toggleFavoriteRequest(project.id)):undefined} />
          {tab==='applications'&&app?.consentPending&&app.studentId!==currentUser?.id&&<button className="btn btn-secondary btn-sm" type="button" disabled={!!consenting} onClick={async ()=>{
            if(!await confirm('Подтвердить участие в команде на условиях, указанных в карточке мероприятия?'))return
            setConsenting(app.id);setConsentNotice('')
            try{await apiClient.consentApplication(app.id);dispatch(fetchApplicationsRequest());setConsentNotice('Согласие отправлено.')}
            catch(e){setConsentNotice((e as Error).message)}
            finally{setConsenting('')}
          }}>Подтвердить участие</button>}
        </div>
      })}</PaginatedGrid>
      {!projects.length && <div className="card empty-state"><p>{search ? 'По вашему запросу ничего не найдено.' : tab === 'favorites' ? 'Сохраненных кейсов пока нет.' : 'Вы еще не подали заявки.'}</p><Link to="/cases" className="btn btn-primary btn-sm">Перейти к витрине</Link></div>}
    </>}
  </div>
}
