import React,{useState} from 'react'
import {axiosInstance} from '../api/http'
import {apiRuntime} from '../api/runtime'
export const FileDownload:React.FC<{file:{name:string;url:string};className?:string}>=({file,className='btn btn-secondary btn-sm'})=>{
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const base=apiRuntime.baseUrl || '/api/v1'
 return <><a className={className} href={file.url} download={/^(data|blob):/.test(file.url)?file.name:undefined} aria-disabled={busy} onClick={async e=>{
   if(apiRuntime.mode!=='live'||!file.url.startsWith(base+'/'))return
   e.preventDefault();if(busy)return;setBusy(true);setError('')
   try{const response=await axiosInstance.get(file.url.slice(base.length),{responseType:'blob'});const url=URL.createObjectURL(response.data);const a=document.createElement('a');a.href=url;const disposition=String(response.headers['content-disposition'] || '');const match=disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);let name=file.name;if(match){try{name=decodeURIComponent(match[1] || match[2])}catch{name=file.name}}a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }}>{busy?'Загрузка…':file.name}</a>{error&&<span role="alert">{error}</span>}</>
}
