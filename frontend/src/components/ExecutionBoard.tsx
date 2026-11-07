import {useConfirm} from './ConfirmProvider'
import { WorkspaceFiles } from './WorkspaceFiles'
import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock, FileCheck2, FileText, MessageSquare, Users } from 'lucide-react'
import { CaseProject } from '../types/models'
import { Execution } from '../types/execution'
import { communityApi } from '../api/community'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCasesRequest, fetchCaseByIdRequest } from '../store/actions'
import { canManageCase } from '../utils/access'
import { SharedProjectPlan } from './SharedProjectPlan'
import { ExecutionDetail } from './ExecutionDetail'
import { CaseComments } from './CaseComments'
import { PaginatedGrid } from './PaginatedGrid'
import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { caseStatusLabels } from '../utils/publication'

export const ExecutionBoard: React.FC<{project:CaseProject; initialView?:string}> = ({project,initialView='teams'}) => {
 const confirm=useConfirm()
  const dispatch=useAppDispatch(), user=useAppSelector(s=>s.auth.currentUser)
  const manager=canManageCase(user,project), student=user?.role==='student', olympiad=project.kind==='olympiad'
  const live=apiRuntime.mode==='live'
  const curator=live&&user?.role==='curator'
  const canSubmit=live&&user?.role==='company'&&manager&&['draft','revision'].includes(project.status)
  const [params] = useSearchParams()
  const [entries,setEntries]=useState<Execution[]>([]), [selected,setSelected]=useState(''), [tab,setTab]=useState('all'), [search,setSearch]=useState('')
  const [view,setView]=useState(initialView), [finished,setFinished]=useState(project.status==='completed'), [loading,setLoading]=useState(true)
  const [ranking,setRanking]=useState<{complete:boolean;items:{id:string;name:string;score:number;max:number}[]}>({complete:false,items:[]})
  const [error,setError]=useState(''), [busy,setBusy]=useState(false)
  const refresh=async()=>{const [e,r]=await Promise.all([communityApi.getExecutions(project.id),curator||canSubmit?{complete:false,items:[]}:communityApi.getLeaderboard(project.id)]);if(params.get('application'))setSelected(e.find(x=>x.applicationId===params.get('application')||`app_${x.id}`===params.get('application'))?.id || '');setEntries(student?e.filter(x=>x.members.some(m=>m.id===user?.id)):e);setRanking(r);setFinished(r.complete||project.status==='completed')}
  const submitForReview=async()=>{
    setBusy(true)
    setError('')
    try{
      await apiClient.submitCase(project.id)
      dispatch(fetchCaseByIdRequest(project.id))
      dispatch(fetchCasesRequest())
    }catch(e){
      setError((e as Error).message)
    }finally{
      setBusy(false)
    }
  }
  useEffect(()=>{setSelected(params.get('execution') || '');setTab('all');setLoading(true);setError('');refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false))},[project.id,user?.id])
  const own=student?entries[0]:undefined, entry=student?own:entries.find(e=>e.id===selected)
  const visible=entries.filter(e=>(tab==='all'||e.status===tab||(tab==='stage_review'&&e.milestones?.some(m=>m.status==='submitted')))&&`${e.name} ${e.members.map(m=>m.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  const completed=own?.milestones?.filter(m=>m.status==='accepted').length || 0, count=own?.milestones?.length || 0
  const tabs=student?[['teams','Контрольные точки'],['submission','Результат и оценка'],['members',own?.teamId?'Моя команда':'Участник'],['plan',olympiad?'Расписание туров':'План задания'],['results','Итоги']]:
    [['teams',curator?'Работы студентов':olympiad?'Участники и работы':'Команды и решения'],['plan',olympiad?'Расписание туров':'Общий план реализации'],...(!curator&&!canSubmit?[['results','Итоги и рейтинг']]:[])]
  return <div className={`execution-board ${student?'student-execution':'organizer-execution'}`}>
    <Link className="workspace-back btn btn-secondary" to="/workspace"><ArrowLeft size={18}/> {student?'Активные проекты':'К списку проектов'}</Link>
    <header className="card execution-header">
      <div className="execution-heading"><div><div className="action-row"><span className="badge badge-direction">{({case:'Кейс',hackathon:'Хакатон',olympiad:'Олимпиада',internship:'Стажировка'})[project.kind || 'case']}</span><span className="badge badge-status status-in_progress">{finished?'Завершён':caseStatusLabels[project.status] || 'Выполняется'}</span></div><h1>{project.title}</h1><p>Заказчик: <strong>{project.companyName}</strong>{student&&own&&<> · {own.teamId?'Команда':'Участник'}: <strong>{own.name}</strong></>}</p></div>
        <div className="action-row"><Link className="btn btn-secondary btn-sm" to={`/cases/${project.id}`}><FileText size={16}/> Описание задания</Link>{student&&own&&!finished&&!own.evaluation&&<button className="btn btn-primary btn-sm" onClick={()=>setView('submission')}><FileCheck2 size={16}/> Сдать результат</button>}</div>
      </div>
      {canSubmit&&<button className="btn btn-primary btn-sm" disabled={busy} onClick={submitForReview}>Отправить на модерацию</button>}
      {student?<div className="execution-own-progress"><div><strong>Выполнение контрольных точек</strong><span>{completed} из {count}</span></div><progress value={completed} max={count || 1} aria-label="Выполнение контрольных точек"/></div>:
        <div className="execution-stats"><span><strong>{entries.length}</strong> {olympiad&&project.participationFormat==='individual'?'участников':'команд / участников'}</span>{!curator&&<><span><strong>{entries.filter(e=>e.submission).length}</strong> сданных работ</span><span><strong>{entries.filter(e=>e.evaluation).length}</strong> оценено</span></>}{!manager&&<span className="observer-label">{curator?'Мониторинг куратора · этапы и комментарии':'Мониторинг куратора · просмотр этапов и результатов'}</span>}</div>}
    </header>
    <div className="uust-container attached-tabs execution-sections">
      <nav className="uust-tabs-row workspace-navigation" aria-label="Разделы проекта">{tabs.map(([value,label])=><button key={value} className={`uust-tab ${view===value?'active':''}`} onClick={()=>setView(value)}>{label}</button>)}<button className={`uust-tab ${view==='discussion'?'active':''}`} onClick={()=>setView('discussion')}><MessageSquare size={15}/> Обсуждение и файлы</button>{manager&&(live||!['olympiad','hackathon'].includes(project.kind || ''))&&<Link className="uust-tab" to={`/company-applications?caseId=${project.id}`}>Заявки на участие</Link>}</nav>
      <div className="uust-box">
        {error&&<p className="form-error" role="alert">{error}</p>}
        {loading?<p role="status">Загрузка выполнений…</p>:<>
          {view==='discussion'&&<section><h2>Обсуждение и файлы</h2><WorkspaceFiles entries={entries}/><CaseComments caseId={project.id}/></section>}
          {view==='plan'&&<SharedProjectPlan project={project} editable={live?canSubmit&&!entries.length:manager} onSaved={refresh}/>}
          {((student&&['teams','submission','members'].includes(view))||(!student&&view==='teams'&&entry))&&entry&&<ExecutionDetail key={entry.id} project={project} entry={entry} manager={manager} finished={finished} onChange={refresh} section={student?(view==='teams'?'stages':view):undefined} onBack={student?undefined:()=>setSelected('')}/>}
          {student&&!own&&['teams','submission','members'].includes(view)&&<div className="empty-state"><h2>Выполнение пока недоступно</h2><p>{live?'Дождитесь одобрения заявки организатором.':'Для кейса дождитесь одобрения заявки. Запись на олимпиаду и хакатон подтверждается автоматически.'}</p><Link className="btn btn-secondary btn-sm" to={`/cases/${project.id}`}>Открыть задание</Link></div>}
          {!student&&view==='teams'&&!entry&&<>
            <div className="execution-filter">{!curator&&<nav className="tabs-bar" aria-label="Статусы работ">{[['all','Все'],['active','В работе'],['stage_review','Этапы на проверке'],['submitted','Сданные решения'],['evaluated','Оценённые решения']].map(([value,label])=><button className={`tab-btn ${tab===value?'active':''}`} key={value} onClick={()=>setTab(value)}>{label}</button>)}</nav>}<label className="sr-only" htmlFor="execution-search">Поиск команды или участника</label><input id="execution-search" className="input" placeholder="Команда или участник" value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <PaginatedGrid className="execution-rows" pageSize={12}>{visible.map(e=><article className="card execution-card" key={e.id}>{!curator&&<span className="badge badge-direction">{e.status==='evaluated'?'Оценено':e.status==='submitted'?'Сдано':finished?'Не сдано':'В работе'}</span>}<h3>{e.name}</h3><p>{olympiad&&!e.teamId?'Индивидуальный зачёт':e.members.map(m=>m.name).join(', ')}<small className="execution-progress">Этапы: {e.milestones?.filter(m=>m.status==='accepted').length || 0} / {e.milestones?.length || 0} · На проверке: {e.milestones?.filter(m=>m.status==='submitted').length || 0}</small></p>{!curator&&<strong>{e.evaluation?`${e.evaluation.totalScore} / ${e.evaluation.maxScore}`:'Без оценки'}</strong>}<button className="btn btn-primary btn-sm" onClick={()=>setSelected(e.id)}>{manager?'Открыть выполнение':'Просмотреть выполнение'}</button></article>)}</PaginatedGrid>
            {!visible.length&&<p className="empty-state">Участников по выбранному фильтру нет.</p>}
          </>}
          {view==='results'&&<section className="execution-leaderboard">
            <div className="feature-toolbar"><h2>{ranking.complete?'Итоговая таблица':'Итоги ещё не опубликованы'}</h2>{manager&&!finished&&<button className="btn btn-primary btn-sm" disabled={busy||!entries.some(e=>e.submission)||entries.some(e=>e.submission&&!e.evaluation)} onClick={async()=>{if(!await confirm('Завершить приём работ и опубликовать итоги? Оценки будут зафиксированы.'))return;setBusy(true);setError('');try{await communityApi.finalizeResults(project.id);await refresh();dispatch(fetchCasesRequest());dispatch(fetchCaseByIdRequest(project.id))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Опубликовать итоги</button>}</div>
            {manager&&!finished&&<p role="status">{entries.some(e=>e.submission)?`Осталось оценить работ: ${entries.filter(e=>e.submission&&!e.evaluation).length}`:'Публикация станет доступна после сдачи работ.'}</p>}<p>{ranking.complete?'При равных баллах участники делят место.':'Организатор опубликует места после проверки всех сданных работ.'}</p>
            {(!student||ranking.complete)&&<div className="table-scroll"><table className="table"><thead><tr>{ranking.complete&&<th>Место</th>}<th>Команда / участник</th><th>Баллы</th></tr></thead><tbody>{ranking.items.map(row=><tr key={row.id}>{ranking.complete&&<td>{ranking.items.findIndex(x=>x.score===row.score)+1}</td>}<td>{row.name}</td><td>{row.score} / {row.max}</td></tr>)}</tbody></table></div>}
          </section>}
        </>}
      </div>
    </div>
  </div>
}
