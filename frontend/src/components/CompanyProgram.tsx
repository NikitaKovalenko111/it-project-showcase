import { apiRuntime } from '../api/runtime'
import { LiveCompanyProgram } from './LiveCompanyProgram'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import React, { useEffect, useState } from 'react'
import { Company } from '../types/models'
import { communityApi } from '../api/community'
import { useAppDispatch } from '../store'
import { fetchCompanyByIdSuccess } from '../store/actions'

export const CompanyProgram: React.FC<{ company: Company; editable: boolean; practice?: boolean }> = ({ company, editable, practice = false }) => {
  const dispatch = useAppDispatch()
  const [text, setText] = useState((practice ? company.practiceProgram : company.internshipProgram) || ''), [editing, setEditing] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { setText((practice ? company.practiceProgram : company.internshipProgram) || ''); setEditing(false) }, [company.id, company.internshipProgram, company.practiceProgram, practice])
  if(apiRuntime.mode==='live')return <LiveCompanyProgram company={company} editable={editable} practice={practice}/>
  return <section className="feature-panel"><h3>{practice?'Практики':'Стажировки'}</h3>{editing ? <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { dispatch(fetchCompanyByIdSuccess(await communityApi.updateCompanyContent(company.id, { description: company.description, ...(practice?{practiceProgram:text}:{internshipProgram:text}) }))); setEditing(false) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}><div data-color-mode="light"><MDEditor value={text} onChange={value=>setText((value || '').slice(0,15000))} height={350} textareaProps={{'aria-label':'Условия, отбор, сроки и контакты',maxLength:15000}} previewOptions={{rehypePlugins:[rehypeSanitize]}}/></div><div className="action-row"><button className="btn btn-primary" disabled={busy}>Сохранить программу</button><button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Отмена</button></div></form> : <><MDEditor.Markdown rehypePlugins={[rehypeSanitize]} source={(practice?company.practiceProgram:company.internshipProgram) || 'Компания пока не опубликовала программу.'} />{editable && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Редактировать программу</button>}</>}{error && <p role="alert">{error}</p>}</section>
}
