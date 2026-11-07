import React,{useEffect,useState} from 'react'
import {FilePicker} from '../components/FilePicker'
import {useAppSelector} from '../store'
const fileDrafts=new Map<string,File[]>()
export const FeedbackPage:React.FC=()=>{
 const userId=useAppSelector(s=>s.auth.currentUser?.id) || 'guest'
 const key=`feedback-draft:${userId}`
 const [text,setText]=useState(()=>sessionStorage.getItem(key) || ''),[files,setFiles]=useState<File[]>(()=>fileDrafts.get(key) || []),[error,setError]=useState('')
 useEffect(()=>{setText(sessionStorage.getItem(key) || '');setFiles(fileDrafts.get(key) || []);setError('')},[key])
 const [previews,setPreviews]=useState<{name:string;url:string}[]>([])
 useEffect(()=>{const next=files.filter(f=>f.type.startsWith('image/')).map(f=>({name:f.name,url:URL.createObjectURL(f)}));setPreviews(next);return()=>next.forEach(p=>URL.revokeObjectURL(p.url))},[files])
 const choose=(next:File[])=>{setError('');if(next.length>5){setError('Можно прикрепить до 5 файлов');return}if(next.some(f=>f.size>2*1024*1024)){setError('Каждый файл должен быть не больше 2 МБ');return}setFiles(next);fileDrafts.set(key,next)}
 return <section className="card feature-panel feedback-form"><h1>Обратная связь</h1><p>Расскажите, что не работает или что вы хотели бы улучшить. Приложите скриншоты или файлы с описанием ошибки.</p><form onSubmit={e=>e.preventDefault()}><label>Ваше сообщение<textarea className="textarea" required maxLength={4000} rows={8} value={text} onChange={e=>{setText(e.target.value);sessionStorage.setItem(key,e.target.value)}}/></label><FilePicker label="Вложения: до 5 файлов, до 2 МБ каждый" files={files} onChange={choose} accept="image/*,.pdf,.txt,.log"/><div className="feedback-previews">{previews.map((p,i)=><a key={i} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name}/></a>)}</div>{error&&<p role="alert">{error}</p>}<p role="status">Отправка временно недоступна: сервер обратной связи ещё не подключён. Текст черновика сохранён. Вложения сохраняются до перезагрузки страницы.</p><button className="btn btn-primary" disabled>Отправить</button></form></section>
}
