import { fetchApplicationsRequest } from '../store/actions'
import { useAppDispatch } from '../store'
import { PaginatedGrid } from '../components/PaginatedGrid'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppSelector } from '../store'
import { participatesInCase, visibleCasesFor } from '../utils/access'
import { isPublished, matchesSearch } from '../utils/publication'
import { CatalogSearch } from '../components/CatalogSearch'
import { ProjectSummaryCard } from '../components/ProjectSummaryCard'
import { listCuratedExecutions } from '../api/community'
import { apiRuntime } from '../api/runtime'

export const WorkspaceListPage: React.FC = () => {
  const { currentUser } = useAppSelector((state) => state.auth)
  const { casesList, loading, error } = useAppSelector((state) => state.cases)
  const { teamsList } = useAppSelector((state) => state.students)
  const dispatch=useAppDispatch()
  const apps=useAppSelector(s=>s.applications.applicationsList)
  const curatorView=apiRuntime.mode==='live'&&currentUser?.role==='curator'
  const [curated,setCurated]=useState<{userId:string;caseIds:Set<string>;error?:string}>()
  useEffect(()=>{
    if(!curatorView){
      dispatch(fetchApplicationsRequest())
      return
    }
    const userId=currentUser!.id
    let active=true
    listCuratedExecutions().then(items=>{
      if(active)setCurated({userId,caseIds:new Set(items.map(item=>item.case_id))})
    }).catch((e:Error)=>{
      if(active)setCurated({userId,caseIds:new Set(),error:e.message})
    })
    return ()=>{active=false}
  },[dispatch,currentUser?.id,curatorView])
  const curatorPending=curatorView&&curated?.userId!==currentUser?.id
  const workspaceError=error || (curatorView?curated?.error:undefined)
  const companyView=currentUser?.role==='company'
  const [kind,setKind]=useState('all'),[status,setStatus]=useState('all')
  const [search, setSearch] = useState('')
  const projects = visibleCasesFor(currentUser, casesList).filter((project) => (companyView || isPublished(project)) && (kind==='all'||(project.kind || 'case')===kind) && (status==='all'||project.status===status)
    && (!curatorView || curated?.caseIds.has(project.id))
    && (currentUser?.role !== 'student' || (participatesInCase(currentUser.id, project, teamsList) || apps.some(a=>a.caseId===project.id && a.status==='accepted')))
    && matchesSearch(search, project.title, project.companyName, project.direction, project.assignedTeamName, project.assignedStudentName, project.recommendedTech))
  return <div>
    <div className="page-header"><div className="page-header__content">
      <h1>{companyView?'Проекты и мероприятия компании':currentUser?.role === 'curator'?'Мониторинг кейсов':'Активные проекты'}</h1>
      <p>{companyView?'Выберите проект: внутри — команды, этапы, проверка работ и общий план.':currentUser?.role==='curator'?'Контролируйте этапы выполнения и результаты участников.':'Выберите проект, чтобы открыть выполнение своего задания.'}</p>
    </div></div>
    <div className="uust-container attached-tabs"><div className="uust-tabs-row workspace-type-filter">{[['all','Все'],['case','Кейсы'],['hackathon','Хакатоны'],['olympiad','Олимпиады'],['internship','Стажировки']].map(([value,label])=><button className={`uust-tab ${kind===value?'active':''}`} key={value} onClick={()=>setKind(value)}>{label}</button>)}</div>
    <div className="uust-box workspace-filter-panel">{companyView&&<label className="workspace-status-filter">Статус<select className="select" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Все статусы</option><option value="open">Приём участников</option><option value="in_progress">В работе</option><option value="completed">Завершены</option><option value="moderation">На модерации</option></select></label>}
    <CatalogSearch value={search} onChange={setSearch} label="Поиск по проекту, компании, команде или направлению" /></div></div>
    {loading || curatorPending ? <p role="status">Загрузка проектов…</p> : workspaceError ? <p role="alert">{workspaceError}</p> : <>
      <p aria-live="polite">Найдено проектов: {projects.length}</p>
      <PaginatedGrid>{projects.map((project) => <ProjectSummaryCard key={project.id} project={project} workspace />)}</PaginatedGrid>
      {!projects.length && <div className="card empty-state"><p>{search ? 'По вашему запросу ничего не найдено.' : 'Доступных проектов пока нет.'}</p><Link to="/cases">Перейти к кейсам</Link></div>}
    </>}
  </div>
}
