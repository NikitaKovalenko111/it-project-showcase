import { formatDate } from '../utils/date'
import {useConfirm} from './ConfirmProvider'
import React, { useState } from 'react'
import { Paperclip, CheckCircle2, Upload } from 'lucide-react'
import { Execution } from '../types/execution'
import { communityApi } from '../api/community'
import { FilePicker } from './FilePicker'
import { uploadFile } from '../utils/files'

export const ExecutionStages: React.FC<{entry:Execution; manager:boolean; participant:boolean; finished:boolean; onChange:()=>Promise<void>}> = ({entry,manager,participant,finished,onChange}) => {
 const confirm=useConfirm()
  const [selected,setSelected]=useState(''), [files,setFiles]=useState<File[]>([]), [reviews,setReviews]=useState<Record<string,string>>({})
  const [error,setError]=useState(''), [busy,setBusy]=useState(false)
  const act=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await fn();await onChange();setFiles([]);setSelected('')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <section className="execution-stages"><h3>Контрольные точки</h3>{error&&<p className="form-error" role="alert">{error}</p>}
    {!entry.milestones?.length&&<p className="empty-state">Организатор ещё не добавил этапы в план проекта.</p>}
    {entry.milestones?.map(stage=>{
      const accepted=stage.status==='accepted', current=['in_progress','submitted','needs_work'].includes(stage.status)
      return <article className={`milestone-item ${accepted?'status-accepted':current?'status-in_progress':''}`} key={stage.id}>
        <div className={`step-number ${accepted?'completed':current?'current':''}`}>{accepted?'✓':stage.stepNumber}</div>
        <div className="step-info"><div className="step-heading"><h4 className="step-title">{stage.title}</h4><span className={`badge badge-status ${accepted?'status-completed':current?'status-open':'status-moderation'}`}>{{pending:'Ожидает',in_progress:'В работе',submitted:'На проверке',accepted:'Зачтено',needs_work:'На доработке'}[stage.status]}</span></div>
          <p className="step-desc preserve-text">{stage.description}</p><p className="step-deadline">Срок сдачи: {formatDate(stage.deadline)}</p>
          <div className="stage-files">{stage.attachedMaterials.map((f,i)=><span className="portfolio-file" key={i}><a href={f.url} download={f.url.startsWith('data:')?f.name:undefined} target="_blank" rel="noreferrer"><Paperclip size={13}/>{f.name}</a>{participant&&!finished&&!accepted&&<button className="icon-delete" aria-label={`Удалить ${f.name}`} disabled={busy} onClick={async()=>{if(await confirm('Удалить материал этапа?'))act(()=>communityApi.updateExecutionStage(entry.id,stage.id,'remove',[],'',i))}}>×</button>}</span>)}</div>
          {stage.feedback&&<blockquote className="stage-review"><strong>Рецензия заказчика</strong><p className="preserve-text">{stage.feedback}</p></blockquote>}
          {participant&&selected===stage.id&&<form className="stage-submit" onSubmit={e=>{e.preventDefault();act(async()=>communityApi.updateExecutionStage(entry.id,stage.id,'submit',await Promise.all(files.map(uploadFile))))}}><FilePicker label="Материалы этапа" files={files} onChange={setFiles}/><div className="action-row"><button className="btn btn-primary btn-sm" disabled={busy||!files.length}>Отправить на проверку</button><button type="button" className="btn btn-secondary btn-sm" onClick={()=>setSelected('')}>Отмена</button></div></form>}
          {manager&&!finished&&stage.status==='submitted'&&<div className="stage-submit"><label>Комментарий к проверке<textarea className="textarea" value={reviews[stage.id] || ''} onChange={e=>setReviews(r=>({...r,[stage.id]:e.target.value}))}/></label><div className="action-row"><button className="btn btn-primary btn-sm" disabled={busy} onClick={()=>act(()=>communityApi.updateExecutionStage(entry.id,stage.id,'accepted',[],reviews[stage.id] || ''))}><CheckCircle2 size={14}/> Зачесть этап</button><button className="btn btn-secondary btn-sm" disabled={busy||!reviews[stage.id]?.trim()} onClick={()=>act(()=>communityApi.updateExecutionStage(entry.id,stage.id,'needs_work',[],reviews[stage.id]))}>Вернуть на доработку</button></div></div>}
        </div>
        {!finished&&participant&&!accepted&&selected!==stage.id&&<div className="milestone-actions"><button className="btn btn-secondary btn-sm" onClick={()=>{setSelected(stage.id);setFiles([])}}><Upload size={14}/> Прикрепить материалы</button></div>}
      </article>
    })}
  </section>
}
