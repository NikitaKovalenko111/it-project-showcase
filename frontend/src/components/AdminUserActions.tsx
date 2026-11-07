import {useConfirm} from './ConfirmProvider'
import React, {useState} from 'react'
import {User} from '../types/models'
import {apiClient,axiosInstance} from '../api/client'
import {apiRuntime} from '../api/runtime'
import {useAppSelector} from '../store'
export const AdminUserActions:React.FC<{user:User}>=({user})=>{
 const confirm=useConfirm()
 const actor=useAppSelector(s=>s.auth.currentUser)
 const [blocked,setBlocked]=useState(!!user.isBlocked),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 if(actor?.role!=='admin'||actor.id===user.id)return null
 return <section className="action-row"><button className="btn btn-secondary" disabled={busy} onClick={async()=>{if(!await confirm(`${blocked?'Разблокировать':'Заблокировать'} пользователя ${user.fullName}?`))return;setBusy(true);setMessage('');try{if(apiRuntime.mode==='live')await axiosInstance.patch(`/users/${user.id}/status`,{status:blocked?'active':'blocked'});else await apiClient.toggleUserBlock(user.id);setBlocked(!blocked);setMessage('Статус пользователя изменён')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}>{blocked?'Разблокировать':'Заблокировать'}</button>{message&&<p role="status">{message}</p>}</section>
}
