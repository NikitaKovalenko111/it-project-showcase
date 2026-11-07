import { FileDownload } from './FileDownload'
import React, { useState } from 'react'
import { Award, Clock, FileCheck2, Upload, Users } from 'lucide-react'
import { CaseProject } from '../types/models'
import { Execution } from '../types/execution'
import { useAppSelector } from '../store'
import { communityApi } from '../api/community'
import { FilePicker } from './FilePicker'
import { uploadFile } from '../utils/files'
import { ExecutionStages } from './ExecutionStages'
import { ExecutionEvaluation } from './ExecutionEvaluation'
import { TeamMembers } from './TeamMembers'
import { legacyCriteria } from '../utils/evaluation'
import { EventRoundWork } from './EventRoundWork'
import { ExecutionComments } from './ExecutionComments'
import { apiRuntime } from '../api/runtime'

export const ExecutionDetail: React.FC<{project:CaseProject; entry:Execution; manager:boolean; finished:boolean; section?:string; onChange:()=>Promise<void>; onBack?:()=>void}> = ({project,entry,manager,finished,section,onChange,onBack}) => {
  const user=useAppSelector(s=>s.auth.currentUser), {studentsList,teamsList}=useAppSelector(s=>s.students)
  const participant=user?.role==='student'&&entry.members.some(m=>m.id===user.id), olympiad=project.kind==='olympiad'
  const liveOlympiad=apiRuntime.mode==='live'&&olympiad
  const curated=apiRuntime.mode==='live'&&user?.role==='curator'
  const [tab,setTab]=useState('stages'), [grading,setGrading]=useState(false), [description,setDescription]=useState(entry.submission?.description || '')
  const [files,setFiles]=useState<File[]>([]), [busy,setBusy]=useState(false), [error,setError]=useState(''), [saved,setSaved]=useState(false)
  const active=section || tab, team=teamsList.find(t=>t.id===entry.teamId)
  return <section className="execution-detail">
    {!participant&&<div className="execution-detail-heading"><div>{onBack&&<button className="btn btn-secondary btn-sm" onClick={onBack}>← К списку участников</button>}<h2>{entry.name}</h2></div>{!liveOlympiad&&manager&&!finished&&entry.submission&&<button className="btn btn-accent btn-sm" onClick={()=>{setTab('submission');setGrading(true)}}><Award size={16}/> {entry.evaluation?'Изменить оценку':'Оценить решение'}</button>}</div>}
    {!section&&<nav className="tabs-bar" aria-label="Выполнение участника">{[['stages','Контрольные точки',Clock],...(!curated?[['submission','Результат и оценка',FileCheck2]]:[]),['members',entry.teamId?'Проектная команда':'Участник',Users]].map(([value,label,Icon])=><button key={value as string} className={`tab-btn ${active===value?'active':''}`} onClick={()=>setTab(value as string)}>{React.createElement(Icon as typeof Clock,{size:16})}{label as string}</button>)}</nav>}
    {active==='stages'&&<ExecutionStages entry={entry} manager={manager} participant={participant} finished={finished} onChange={onChange}/>}
    {active==='stages'&&apiRuntime.mode==='live'&&<ExecutionComments executionId={entry.id}/>}
    {active==='members'&&<section className="execution-members"><h2>{entry.teamId?entry.name:'Участник'}</h2><TeamMembers members={entry.members} leaderId={team?.leaderId} students={studentsList}/></section>}
    {active==='submission'&&liveOlympiad&&<EventRoundWork caseId={project.id} executionId={entry.id} participant={participant} manager={manager}/>}
    {active==='submission'&&!liveOlympiad&&<div className="execution-result-grid">
      <section className="card result-card"><div className="card__header"><h3>{olympiad?'Решения заданий':'Результат выполнения'}</h3><FileCheck2 size={20}/></div><div className="card__body">
        {entry.submission?<><p className="preserve-text">{entry.submission.description}</p><div className="stage-files">{entry.submission.attachedFiles.map((f,i)=><FileDownload key={i} file={f}/>)}</div></>:<p className="empty-state">{participant?'Вы ещё не отправили результат.':'Участник ещё не сдал работу.'}</p>}
        {participant&&!finished&&!entry.evaluation&&<form className="execution-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setSaved(false);try{await communityApi.submitExecution(entry.id,description,[...(entry.submission?.attachedFiles || []),...await Promise.all(files.map(uploadFile))]);await onChange();setFiles([]);setSaved(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>
          <label>{olympiad?'Решения и пояснения':'Описание решения'}<textarea className="textarea" required value={description} onChange={e=>setDescription(e.target.value)}/></label><FilePicker label="Материалы решения (каждый до 2 МБ)" files={files} onChange={setFiles}/>
          <button className="btn btn-primary btn-sm" disabled={busy}><Upload size={16}/> {entry.submission?'Обновить результат':'Сдать результат'}</button>
          {error&&<p className="form-error" role="alert">{error}</p>}{saved&&<p className="inline-notice" role="status">Результат отправлен на проверку.</p>}
        </form>}
      </div></section>
      <section className="card result-card"><div className="card__header"><h3>Оценка и рецензия</h3><Award size={20}/></div><div className="card__body">
        {entry.evaluation?<><div className="score-banner"><div><small>Итоговая оценка</small><strong>{entry.evaluation.totalScore} / {entry.evaluation.maxScore}</strong></div><Award size={36}/></div><dl className="score-breakdown">{Object.entries(entry.evaluation.scores).map(([id,score])=><div key={id}><dt>{(project.olympiadTasks || []).find(c=>c.id===id)?.title || (project.evaluationCriteria || legacyCriteria).find(c=>c.id===id)?.label || id}</dt><dd>{score}</dd></div>)}</dl><blockquote className="stage-review"><p className="preserve-text">{entry.evaluation.feedback}</p><small>{entry.evaluation.evaluatorName}</small></blockquote></>:
          <p className="empty-state">{entry.submission?'Результат ожидает проверки.':'Оценка появится после сдачи и проверки результата.'}</p>}
        {manager&&!finished&&entry.submission&&<button className="btn btn-accent btn-sm" onClick={()=>setGrading(true)}><Award size={16}/> {entry.evaluation?'Изменить оценку':'Оценить решение'}</button>}
      </div></section>
    </div>}
    {grading&&manager&&!finished&&<ExecutionEvaluation project={project} entry={entry} onClose={()=>setGrading(false)} onSaved={onChange}/>}
  </section>
}
