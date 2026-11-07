import { useEffect, useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import { axiosInstance } from '../api/http'
import { collectNumbered } from '../api/backend'
import type { Company } from '../types/models'

type Program = {
  program_id:string; company_id:string; title:string; summary:string; content_markdown:string
  capacity:number|null; application_deadline:string|null; status:string
}
const stateLabels:Record<string,string>={moderation:'На модерации',revision:'На доработке',draft:'Черновик'}

export function LiveCompanyProgram({company,editable,practice}:{company:Company;editable:boolean;practice:boolean}) {
  const [programs,setPrograms]=useState<Program[]>([])
  const [editor,setEditor]=useState<Partial<Program>>()
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    let active=true
    if(!practice)collectNumbered<Program>(params=>axiosInstance.get('/internships',{params})).then(items=>{
      if(active)setPrograms(items.filter(item=>item.company_id===company.id))
    }).catch(e=>{if(active)setError(e.message)})
    return ()=>{active=false}
  },[company.id,practice])
  if(practice)return <section className="feature-panel"><h3>Практики</h3><p>Программы практик пока не опубликованы.</p>{editable&&<p>Публикация практик временно недоступна.</p>}</section>

  return <section className="feature-panel">
    <h3>Стажировки</h3>
    {programs.map(program=><article key={program.program_id} className="feature-row">
      <h4>{program.title}</h4>
      <p>{[stateLabels[program.status],program.capacity&&`Мест: ${program.capacity}`].filter(Boolean).join(' · ')}</p>
      <MDEditor.Markdown source={program.content_markdown} rehypePlugins={[rehypeSanitize]}/>
      {editable&&!editor&&['published','revision','draft'].includes(program.status)&&<button className="btn btn-secondary btn-sm" onClick={()=>{setEditor(program);setError('');setNotice('')}}>Редактировать</button>}
    </article>)}
    {!programs.length&&<p>Компания пока не опубликовала программы стажировок.</p>}
    {editable&&!editor&&<button className="btn btn-secondary" onClick={()=>{setEditor({});setError('');setNotice('')}}>Новое объявление о стажировке</button>}
    {editor&&<form className="execution-form" onSubmit={async e=>{
      e.preventDefault();setBusy(true);setError('');setNotice('')
      try{
        const payload={company_id:company.id,title:editor.title,summary:editor.summary,content_markdown:editor.content_markdown,
          capacity:editor.capacity,application_deadline:editor.application_deadline || null}
        const {data:saved}=editor.program_id
          ? await axiosInstance.put<Program>(`/internships/${editor.program_id}`,payload)
          : await axiosInstance.post<Program>('/internships',payload)
        setEditor(saved)
        setPrograms(items=>[saved,...items.filter(item=>item.program_id!==saved.program_id)])
        const {data:submitted}=await axiosInstance.patch<Program>(`/internships/${saved.program_id}/status`,{status:'moderation',comment:''})
        setPrograms(items=>[submitted,...items.filter(item=>item.program_id!==submitted.program_id)])
        setEditor(undefined);setNotice('Объявление отправлено на модерацию.')
      }catch(cause){setError((cause as Error).message)}
      finally{setBusy(false)}
    }}>
      <fieldset className="execution-form" disabled={busy}>
        <label>Название<input className="input" required maxLength={300} value={editor.title || ''} onChange={e=>setEditor({...editor,title:e.target.value})}/></label>
        <label>Краткое описание<textarea className="textarea" required maxLength={500} value={editor.summary || ''} onChange={e=>setEditor({...editor,summary:e.target.value})}/></label>
        <div className="responsive-grid">
          <label>Количество мест<input className="input" required type="number" min="1" max="10000" value={editor.capacity || ''} onChange={e=>setEditor({...editor,capacity:Number(e.target.value)})}/></label>
          <label>Срок подачи заявок<input className="input" type="date" value={editor.application_deadline?.slice(0,10) || ''} onChange={e=>setEditor({...editor,application_deadline:e.target.value?`${e.target.value}T23:59:59Z`:null})}/></label>
        </div>
        <div data-color-mode="light"><MDEditor value={editor.content_markdown || ''} onChange={value=>setEditor({...editor,content_markdown:(value || '').slice(0,15000)})}
          textareaProps={{'aria-label':'Программа стажировки'}} previewOptions={{rehypePlugins:[rehypeSanitize]}}/></div>
        <div className="action-row">
          <button className="btn btn-primary" disabled={!editor.content_markdown?.trim()}>Отправить на модерацию</button>
          <button type="button" className="btn btn-secondary" onClick={()=>setEditor(undefined)}>Отмена</button>
        </div>
      </fieldset>
    </form>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>
}
