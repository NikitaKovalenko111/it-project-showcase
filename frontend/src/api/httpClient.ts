import axios,{AxiosError,InternalAxiosRequestConfig} from 'axios'
type Options={baseURL:string;timeoutMs:number;tokenStore:{get:()=>string|null;set:(token:string)=>void;clear:()=>void};getRefreshToken:()=>string|null;saveRefreshToken:(token:string)=>void;onUnauthorized:()=>void;refreshTokens?:(token:string)=>Promise<{access_token:string;refresh_token:string}>}
export function createHttpClient(options:Options){
 const {tokenStore}=options
 const client=axios.create({baseURL:options.baseURL,timeout:options.timeoutMs,headers:{Accept:'application/json'}})
 client.interceptors.request.use((config:InternalAxiosRequestConfig)=>{const token=tokenStore.get();if(token)config.headers.Authorization=`Bearer ${token}`;return config})
 let refresh:Promise<void>|null=null
 const credentials=['/auth/login','/auth/register','/auth/refresh','/auth/logout']
 const unauthorized=()=>{tokenStore.clear();options.onUnauthorized()}
 client.interceptors.response.use(response=>response,async(error:AxiosError<any>)=>{
  const config=error.config as (InternalAxiosRequestConfig & {_retried?:boolean})|undefined
  const url=config?.url || ''
  if(error.response?.status===401&&config&&!credentials.includes(url)&&!config._retried){
   const token=options.getRefreshToken()
   if(token){config._retried=true;try{
    if(!refresh)refresh=(options.refreshTokens?options.refreshTokens(token):axios.post(`${options.baseURL}/auth/refresh`,{refresh_token:token}).then(r=>r.data)).then(data=>{tokenStore.set(data.access_token);options.saveRefreshToken(data.refresh_token)}).finally(()=>{refresh=null})
    await refresh;config.headers.Authorization=`Bearer ${tokenStore.get()}`;return client(config)
   }catch{/* The common unauthorized handler below clears the session once. */}}
  }
  if(error.response?.status===401&&!credentials.includes(url))unauthorized()
  return Promise.reject(Object.assign(new Error(error.response?.data?.error?.message || (error.response?`Ошибка API (${error.response.status})`:'Сервер недоступен. Проверьте подключение к API.')),{status:error.response?.status,code:error.response?.data?.error?.code}))
 })
 return client
}
