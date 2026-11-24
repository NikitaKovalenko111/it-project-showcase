import React, { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCaseByIdRequest } from '../store/actions'
import { ExecutionBoard } from '../components/ExecutionBoard'
export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>(),
    dispatch = useAppDispatch()
  const { activeCase, error } = useAppSelector((s) => s.cases)
  useEffect(() => {
    if (id) dispatch(fetchCaseByIdRequest(id))
  }, [id, dispatch])
  if (error && activeCase?.id !== id)
    return (
      <div role="alert" className="card feature-panel">
        {error} <Link to="/workspace">К списку проектов</Link>
      </div>
    )
  if (!activeCase || activeCase.id !== id)
    return <p role="status">Загрузка рабочего пространства…</p>
  return <ExecutionBoard key={activeCase.id} project={activeCase} />
}
