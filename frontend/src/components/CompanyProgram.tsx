import { FormattedText } from './FormattedText'
import React, { useEffect, useState } from 'react'
import { Company } from '../types/models'
import { communityApi } from '../api/community'
import { useAppDispatch } from '../store'
import { fetchCompanyByIdSuccess } from '../store/actions'

export const CompanyProgram: React.FC<{ company: Company; editable: boolean }> = ({ company, editable }) => {
  const dispatch = useAppDispatch()
  const [text, setText] = useState(company.internshipProgram || ''), [editing, setEditing] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { setText(company.internshipProgram || ''); setEditing(false) }, [company.id, company.internshipProgram])
  return <section className="feature-panel"><h3>Программа стажировок</h3>{editing ? <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { dispatch(fetchCompanyByIdSuccess(await communityApi.updateCompanyContent(company.id, { description: company.description, internshipProgram: text }))); setEditing(false) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}><div className="action-row" role="toolbar" aria-label="Форматирование программы"><button type="button" className="btn btn-secondary" onClick={() => setText(t => t + '\n## Заголовок\n')}>Заголовок</button><button type="button" className="btn btn-secondary" onClick={() => setText(t => t + '**Важный текст**')}>Жирный</button><button type="button" className="btn btn-secondary" onClick={() => setText(t => t + '[Название ссылки](https://example.com)')}>Ссылка</button></div><label>Условия, отбор, сроки и контакты<textarea className="textarea" value={text} maxLength={15000} onChange={(e) => setText(e.target.value)} /></label><details><summary>Предпросмотр</summary><FormattedText text={text} /></details><div className="action-row"><button className="btn btn-primary" disabled={busy}>Сохранить программу</button><button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Отмена</button></div></form> : <><FormattedText text={company.internshipProgram || 'Компания пока не опубликовала программу стажировок.'} />{editable && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Редактировать программу</button>}</>}{error && <p role="alert">{error}</p>}</section>
}
