import {useConfirm} from './ConfirmProvider'
import React, {useState} from 'react'
import {CaseProject} from '../types/models'
import {apiClient} from '../api/client'
import {useAppDispatch,useAppSelector} from '../store'
import {fetchCaseByIdRequest,fetchCasesRequest} from '../store/actions'
export const AdminCaseActions:React.FC<{project:CaseProject}>=({project})=>{
 const confirm=useConfirm()
 const actor=useAppSelector(s=>s.auth.currentUser), dispatch=useAppDispatch()
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 if(actor?.role!=='admin')return null
 const hidden=project.moderationStatus==='hidden'
 return <><button className="btn btn-secondary btn-sm" disabled={busy} onClick={async()=>{
   if(!await confirm(`${hidden?'Восстановить публикацию':'Скрыть кейс'} «${project.title}»?`))return
   setBusy(true);setError('')
   try{await apiClient.moderatePublication('case',project.id,hidden?'approved':'hidden','Решение администратора из карточки кейса');dispatch(fetchCaseByIdRequest(project.id));dispatch(fetchCasesRequest())}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }}>{hidden?'Восстановить кейс':'Заблокировать кейс'}</button>{error&&<p role="alert">{error}</p>}</>
}
