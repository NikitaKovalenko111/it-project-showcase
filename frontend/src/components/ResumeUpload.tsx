import React,{useEffect,useState} from 'react'
import {apiClient} from '../api/client'
import {uploadFile} from '../utils/files'
import {FileDownload} from './FileDownload'
import type {StudentProfile} from '../types/models'
export const ResumeUpload:React.FC=()=>{
 const [resume,setResume]=useState<StudentProfile['resume']>(),[selected,setSelected]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{let active=true;apiClient.getResume().then(file=>{if(active)setResume(file)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
 return <section className="resume-upload"><h3>Резюме (CV)</h3><p>PDF, DOC или DOCX, до 2 МБ. Сохранённое резюме будет доступно при подаче заявки.</p>{resume&&<FileDownload file={resume}/>}<label>Выбрать резюме<input type="file" className="input" accept=".pdf,.doc,.docx" disabled={busy} onChange={e=>{setError('');setNotice('');const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>2*1024*1024||! /\.(pdf|docx?)$/i.test(file.name)){setError('Выберите PDF, DOC или DOCX размером до 2 МБ');setSelected(null);return}setSelected(file)}}/></label>{selected&&<p>{selected.name}</p>}<button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selected} onClick={async()=>{if(!selected)return;setBusy(true);setError('');try{const file=await uploadFile(selected);await apiClient.saveResume(file);setResume(file);setSelected(null);setNotice('Резюме сохранено')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{busy?'Загрузка…':resume?'Заменить резюме':'Загрузить резюме'}</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</section>
}
