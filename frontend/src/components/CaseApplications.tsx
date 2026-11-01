import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { CaseApplication } from '../types/models'
import { useAppDispatch } from '../store'
import { fetchApplicationsRequest, fetchCaseByIdRequest, fetchTeamsRequest } from '../store/actions'

const labels = { pending: 'На рассмотрении', interview: 'Интервью', need_info: 'Нужны уточнения', accepted: 'Принят', rejected: 'Отклонен' }
export const CaseApplications: React.FC<{ caseId: string }> = ({ caseId }) => {
  const dispatch = useAppDispatch()
  const [applications, setApplications] = useState<CaseApplication[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { apiClient.getApplications(caseId).then(setApplications).catch((e) => setError(e.message)) }, [caseId])
  const decide = async (id: string, status: CaseApplication['status']) => { setBusy(true); setError(''); try { await apiClient.updateApplicationStatus(id, status); setApplications(await apiClient.getApplications(caseId)); dispatch(fetchApplicationsRequest(caseId)); dispatch(fetchTeamsRequest()); dispatch(fetchCaseByIdRequest(caseId)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <section className="card feature-panel"><h2>Заявки студентов на кейс</h2>{error && <p role="alert">{error}</p>}{!applications.length && <p>Заявок пока нет.</p>}{applications.map((a) => <article key={a.id} className="feature-row"><Link to={`/profile/${a.studentId}`}>{a.studentName}</Link><strong>{a.teamName}</strong><p>{a.coverLetter}</p><span>{labels[a.status]}</span>{!['accepted', 'rejected'].includes(a.status) && <div className="action-row">{(['interview', 'need_info', 'accepted', 'rejected'] as const).map((status) => status !== a.status && <button key={status} className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide(a.id, status)}>{({ interview: 'Назначить интервью', need_info: 'Запросить уточнения', accepted: 'Принять', rejected: 'Отклонить' })[status]}</button>)}</div>}</article>)}</section>
}
