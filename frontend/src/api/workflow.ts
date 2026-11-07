import { collectPages, fromStage, fromTeam } from './backend'
import type { Execution } from '../types/execution'
import type { ProjectMilestone } from '../types/models'
type CaseStageDTO = {stage_id:string; ordinal:number; title:string; expected_result?:string; due_at?:string}
type PlanRow = Pick<ProjectMilestone,'id'|'title'|'description'|'deadline'>
type ExecutionReference = {execution_id:string;case_id:string}
// Injecting transport keeps API payloads testable without a browser or mock storage.
export function createWorkflow(http:any){
 const items=async(path:string,params?:any)=>(await http.get(path,{params})).data.items || []
 const files=(xs:any[],executionId:string,submissionId:string)=>(xs || []).map(f=>({name:f.original_name || 'Материал решения',file_id:f.file_id,url:`/api/v1/submissions/${submissionId}/files/${f.file_id}`}))
 const submission=(d:any,caseId:string)=>d?({id:d.submission_id,caseId,studentId:d.submitted_by,authorName:'',description:d.description,repoUrl:d.repository_url || '',screenshots:[],attachedFiles:files(d.files, d.execution_id,d.submission_id),submittedAt:d.submitted_at}):undefined
 const evaluation=(d:any,caseId:string)=>d?({id:d.evaluation_id,caseId,companyId:'',companyName:'',evaluatorName:'Представитель компании',scores:Object.fromEntries((d.scores || []).map((s:any)=>[s.criterion_id,s.score])),totalScore:d.total_score,maxScore:d.max_score,feedback:d.feedback || '',evaluatedAt:d.created_at}):undefined
 const getExecution=async(id:string,curator=false):Promise<Execution>=>{
   const d=(await http.get(`/executions/${id}`)).data
   const [stages,submissions]=await Promise.all([items(`/executions/${id}/stages`),curator?[]:collectPages<any>(params=>http.get(`/executions/${id}/submissions`,{params}))])
   const latest=submissions.find(s=>s.kind==='final')
   const evaluations=latest?await items(`/submissions/${latest.submission_id}/evaluations`):[]
   const graded=evaluations[0]
   return {id:d.execution_id,caseId:d.case_id,applicationId:d.application_id,teamId:d.team_id || undefined,name:d.team_name || d.members?.map((m:any)=>m.name).join(', ') || d.case_title,members:(d.members || []).filter((m:any)=>!m.left_at).map((m:any)=>({id:m.student_id,name:m.name,role:m.role_name || 'Участник',competencies:[]})),status:graded?'evaluated':latest?'submitted':'active',submission:submission(latest,d.case_id),evaluation:evaluation(graded,d.case_id),milestones:stages.map((s:any)=>({...fromStage(s,d.case_id),attachedMaterials:submission(submissions.find(x=>x.kind==='stage'&&x.stage_id===s.stage_id),d.case_id)?.attachedFiles || []}))}
 }
 const getExecutions=async(caseId:string):Promise<Execution[]>=>{
   const apps=await collectPages<any>(params=>http.get('/applications',{params}),{case_id:caseId})
   return Promise.all([...new Set(apps.map(a=>a.execution_id).filter(Boolean))].map(id=>getExecution(id)))
 }
 const listCuratedExecutions=async(caseId?:string)=>{
   const items=await collectPages<ExecutionReference>(params=>http.get('/executions',{params}))
   return caseId?items.filter(item=>item.case_id===caseId):items
 }
 const getCuratedExecutions=async(caseId:string)=>Promise.all(
   (await listCuratedExecutions(caseId)).map(item=>getExecution(item.execution_id,true)),
 )
 const send=async(executionId:string,description:string,attachments:any[],stageId?:string)=>{
   const state=(await http.get(`/executions/${executionId}`)).data
   if(state.status==='accepted')await http.patch(`/executions/${executionId}/status`,{status:'in_progress'})
   if(stageId){const stage=(await items(`/executions/${executionId}/stages`)).find((s:any)=>s.stage_id===stageId);if(stage&&['pending','revision'].includes(stage.status))await http.patch(`/executions/${executionId}/stages/${stageId}`,{status:'in_progress',feedback:''})}
   const payload={kind:stageId?'stage':'final',title:stageId?'Результат этапа':'Итоговое решение',description,stage_id:stageId || '',files:attachments.map((f,i)=>{if(!f.file_id)throw new Error('Загрузите файл на сервер перед отправкой');return {file_id:f.file_id,kind:'attachment',ordinal:i+1}})}
   await http.post(`/executions/${executionId}/submissions`,payload)
 }
 const updateSharedPlan=async(caseId:string, rows:PlanRow[], baseline?:PlanRow[])=>{
   const path=`/cases/${caseId}/stages`
   const before:CaseStageDTO[]=await items(path)
   const byId=new Map(before.map(stage=>[stage.stage_id,stage]))
   if(baseline&&(before.length!==baseline.length||before.some((stage,i)=>{
     const row=baseline[i]
     return row.id!==stage.stage_id||row.title!==stage.title||row.description!==(stage.expected_result || '')||row.deadline!==(stage.due_at || '').slice(0,10)
   })))throw new Error('План изменился на сервере. Проверьте актуальные этапы перед сохранением.')
   if(rows.some(row=>!row.id.startsWith('plan_')&&!byId.has(row.id)))throw new Error('План изменился на сервере. Откройте его заново.')
   let nextOrdinal=Math.max(0,...before.map(stage=>stage.ordinal))+1
   const stageIds:string[]=[]
   for(const row of rows){
     const old=byId.get(row.id)
     const dueAt=row.deadline?`${row.deadline}T23:59:59Z`:null
     if(old){
       const sameDate=(old.due_at || '').slice(0,10)===row.deadline
       if(old.title!==row.title||(old.expected_result || '')!==row.description||!sameDate){
         await http.patch(`${path}/${row.id}`,{ordinal:old.ordinal,title:row.title,expected_result:row.description,due_at:sameDate?(old.due_at || null):dueAt})
       }
       stageIds.push(row.id)
     }else{
       const {data}=await http.post(path,{ordinal:nextOrdinal++,title:row.title,expected_result:row.description,due_at:dueAt})
       stageIds.push(data.stage_id)
     }
   }
   for(const stage of before)if(!stageIds.includes(stage.stage_id))await http.delete(`${path}/${stage.stage_id}`)
   const currentOrder=before.filter(stage=>stageIds.includes(stage.stage_id)).map(stage=>stage.stage_id)
   currentOrder.push(...stageIds.filter(id=>!byId.has(id)))
   if(stageIds.some((id,i)=>id!==currentOrder[i]||byId.get(id)?.ordinal!==i+1)){
     if(stageIds.length)await http.put(`${path}/order`,{stage_ids:stageIds})
   }
   return (await items(path)).map((stage:any)=>fromStage(stage,caseId))
 }
 return {getExecution,getExecutions,updateSharedPlan,listCuratedExecutions,getCuratedExecutions,
  getSharedPlan:async(caseId:string)=>(await items(`/cases/${caseId}/stages`)).map((s:any)=>fromStage(s,caseId)),
  submitExecution:async(id:string,description:string,attachments:any[])=>{await send(id,description,attachments);return getExecution(id)},
  gradeExecution:async(id:string,scores:Record<string,number>,feedback:string)=>{const entry=await getExecution(id);if(!entry.submission)throw new Error('Работа ещё не сдана');await http.post(`/submissions/${entry.submission.id}/evaluations`,{feedback,scores:Object.entries(scores).map(([criterion_id,score])=>({criterion_id,score}))});return getExecution(id)},
  updateExecutionStage:async(id:string,stageId:string,action:string,attachments:any[]=[],feedback='')=>{if(action==='remove')throw new Error('Удаление материала сданного этапа пока не поддерживается сервером');if(action==='submit')await send(id,feedback || 'Материалы этапа',attachments,stageId);await http.patch(`/executions/${id}/stages/${stageId}`,{status:action==='needs_work'?'revision':action==='submit'?'submitted':action,feedback});return getExecution(id)},
  getLeaderboard:async(caseId:string)=>{const rows=await items(`/cases/${caseId}/leaderboard`);return {complete:rows.length>0&&rows.every((r:any)=>Number.isInteger(r.place_no)&&r.place_no>0),items:rows.map((r:any)=>({id:r.execution_id,name:r.team_name || 'Участник',score:r.total_score,max:r.max_score}))}},
  finalizeResults:async(caseId:string)=>{const rows=await items(`/cases/${caseId}/leaderboard`);await http.put(`/cases/${caseId}/leaderboard/placements`,{placements:rows.map((r:any,i:number)=>({execution_id:r.execution_id,place_no:i+1}))})},
 }
}
