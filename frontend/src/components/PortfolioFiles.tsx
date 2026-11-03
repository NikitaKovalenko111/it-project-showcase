import React, { useState } from 'react'
import { User } from '../types/models'
import { uploadFile } from '../utils/files'
import { apiClient } from '../api/client'
import { useAppDispatch } from '../store'
import { fetchStudentsRequest, fetchCurrentUserRequest } from '../store/actions'
export const PortfolioFiles: React.FC<{ user: User; editable: boolean }> = ({ user, editable }) => {
  const dispatch = useAppDispatch()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const files = user.studentProfile?.files || []
  const save = async (next: typeof files) => {
    await apiClient.updateUser({ ...user, studentProfile: { ...user.studentProfile!, files: next } })
    dispatch(fetchStudentsRequest()); dispatch(fetchCurrentUserRequest())
  }
  return <section className="card feature-panel"><h2>Достижения и сертификаты</h2><div className="achievement-gallery">{files.map((f,i) => <div className="portfolio-file achievement-card" key={i}><a href={f.url} target="_blank" rel="noreferrer">{(/\.(png|jpe?g|webp|gif)$/i.test(f.name) || f.url.startsWith('data:image/')) ? <img src={f.url} alt={f.name} loading="lazy" /> : <div className="achievement-document">Сертификат / документ</div>}<span>{f.name}</span></a>{editable && <button type="button" className="file-remove" aria-label={`Удалить ${f.name}`} disabled={busy} onClick={async () => { if (!confirm(`Удалить файл «${f.name}»?`)) return; setBusy(true); try { await save(files.filter((_,j) => j !== i)) } catch(e) { setError((e as Error).message) } finally { setBusy(false) } }}>×</button>}</div>)}</div>
    {editable && <label>Добавить фотографии достижений или сертификаты (до 2 МБ)<input type="file" accept="image/*,.pdf" multiple disabled={busy} onChange={async e => { const selected = Array.from(e.target.files || []); e.target.value = ''; setBusy(true); setError(''); try { await save([...files, ...await Promise.all(selected.map(uploadFile))]) } catch(e) { setError((e as Error).message) } finally { setBusy(false) } }} /></label>}{error && <p role="alert">{error}</p>}
  </section>
}
