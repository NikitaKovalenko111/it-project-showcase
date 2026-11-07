import React,{useEffect,useState} from 'react'
import {FilePicker} from '../components/FilePicker'
import {useAppSelector} from '../store'
import {axiosInstance} from '../api/http'
import {apiRuntime} from '../api/runtime'
import {collectNumbered} from '../api/backend'
import {uploadFile} from '../utils/files'
import {FileDownload} from '../components/FileDownload'
import {ReportTableView} from '../components/ReportTableView'

type Feedback = {feedback_id:string;body:string;file_ids:string[];created_at:string;status:'reviewing'|'accepted'|'rejected'}
const labels = {reviewing:'На рассмотрении',accepted:'Принято',rejected:'Отклонено'}
const fileDrafts=new Map<string,File[]>()
export const FeedbackPage:React.FC=()=>{
 const user=useAppSelector(s=>s.auth.currentUser)
 const userId=user?.id || 'guest'
 const live=apiRuntime.mode==='live'
 const admin=user?.role==='admin'
 const key=`feedback-draft:${userId}`
 const [text,setText]=useState(()=>sessionStorage.getItem(key) || ''),[files,setFiles]=useState<File[]>(()=>fileDrafts.get(key) || []),[error,setError]=useState('')
 const [records,setRecords]=useState<Feedback[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{
  let active=true
  if(live)collectNumbered<Feedback>(params=>axiosInstance.get(admin?'/feedback':'/feedback/mine',{params}))
    .then(rows=>{if(active)setRecords(rows)}).catch(e=>{if(active)setError(e.message)})
  return ()=>{active=false}
 },[admin,userId,live])
 useEffect(()=>{setText(sessionStorage.getItem(key) || '');setFiles(fileDrafts.get(key) || []);setError('')},[key])
 const [previews,setPreviews]=useState<{name:string;url:string}[]>([])
 useEffect(()=>{const next=files.filter(f=>f.type.startsWith('image/')).map(f=>({name:f.name,url:URL.createObjectURL(f)}));setPreviews(next);return()=>next.forEach(p=>URL.revokeObjectURL(p.url))},[files])
 const choose=(next:File[])=>{setError('');if(next.length>5){setError('Можно прикрепить до 5 файлов');return}if(next.some(f=>f.size>2*1024*1024)){setError('Каждый файл должен быть не больше 2 МБ');return}setFiles(next);fileDrafts.set(key,next)}
 return <section className="card feature-panel feedback-form">
  <h1>Обратная связь</h1>
  {!admin&&<><p>Расскажите, что не работает или что вы хотели бы улучшить.</p>
    <form onSubmit={async e=>{
      e.preventDefault()
      if(!live||busy||!text.trim())return
      setBusy(true);setError('');setNotice('')
      try{
        const uploads=await Promise.all(files.map(uploadFile))
        const {data}=await axiosInstance.post<Feedback>('/feedback',{body:text.trim(),file_ids:uploads.map(file=>file.file_id)})
        setRecords(items=>[data,...items])
        setText('');setFiles([]);sessionStorage.removeItem(key);fileDrafts.delete(key)
        setNotice('Обращение отправлено.')
      }catch(cause){setError((cause as Error).message)}
      finally{setBusy(false)}
    }}>
      <label>Ваше сообщение<textarea className="textarea" required maxLength={4000} rows={8} disabled={busy} value={text} onChange={e=>{setText(e.target.value);sessionStorage.setItem(key,e.target.value)}}/></label>
      <fieldset disabled={busy}><FilePicker label="Вложения: до 5 файлов, до 2 МБ каждый" files={files} onChange={choose} accept="image/*,.pdf,.txt,.log"/></fieldset>
      <div className="feedback-previews">{previews.map((p,i)=><a key={i} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name}/></a>)}</div>
      {!live&&<p>В деморежиме доступен черновик обращения.</p>}
      <button className="btn btn-primary" disabled={!live||busy||!text.trim()}>{busy?'Отправка…':'Отправить'}</button>
    </form>
  </>}
  {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {live&&<section className="report-section"><h2>{admin?'Очередь обращений':'Мои обращения'}</h2>
    <ReportTableView label="Обращения" headers={['Дата','Сообщение','Статус',...(admin?['Действия']:[])]}
      rows={records.map(record=>({id:record.feedback_id,cells:[
        new Date(record.created_at).toLocaleString('ru-RU'),
        <><p className="preserve-text">{record.body}</p><div className="action-row">{(record.file_ids || []).map((id,i)=><FileDownload key={id} file={{name:`Вложение ${i+1}`,url:`/api/v1/feedback/${record.feedback_id}/files/${id}`}}/>)}</div></>,
        labels[record.status],
        ...(admin?[record.status==='reviewing'&&<div className="action-row">{(['accepted','rejected'] as const).map(status=><button key={status} className="btn btn-secondary btn-sm" disabled={busy} onClick={async ()=>{
          setBusy(true);setError('')
          try{await axiosInstance.patch(`/feedback/${record.feedback_id}/status`,{status});setRecords(items=>items.map(item=>item.feedback_id===record.feedback_id?{...item,status}:item))}
          catch(cause){setError((cause as Error).message)}
          finally{setBusy(false)}
        }}>{status==='accepted'?'Принять':'Отклонить'}</button>)}</div>]:[]),
      ]}))} emptyText="Обращений пока нет." />
  </section>}
 </section>
}
