import React, { useState, useEffect } from 'react'
import { communityApi } from '../api/community'
import { StudentProject } from '../types/models'
import { useAppDispatch } from '../store'
import { fetchStudentProjectsRequest, fetchStudentProjectByIdRequest } from '../store/actions'

export const ProjectVisibility: React.FC<{ project: StudentProject }> = ({ project }) => {
  const dispatch = useAppDispatch()
  const [visibility, setVisibility] = useState(project.visibility || 'public'), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(()=>setVisibility(project.visibility || 'public'),[project.id,project.visibility])
  const save = async (value: 'private' | 'public') => { setBusy(true); setError(''); try { await communityApi.setStudentProjectVisibility(project.id, value); dispatch(fetchStudentProjectsRequest()); dispatch(fetchStudentProjectByIdRequest(project.id)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <div className="visibility-settings"><label>Видимость<select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}><option value="private">Только я</option><option value="public">Общее обозрение после проверки</option></select></label>
    <button className="btn btn-secondary btn-sm" disabled={busy || (visibility === 'public' && project.visibility !== 'private' && (project.moderationStatus === 'pending' || project.isModerated))} onClick={() => save(visibility)}>{visibility === 'private' ? 'Сохранить приватным' : 'Отправить на общее обозрение'}</button>{project.visibility === 'private' && <span>Приватный проект</span>}{error && <p role="alert">{error}</p>}
  </div>
}
