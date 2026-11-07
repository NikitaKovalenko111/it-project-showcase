import { CaseProject, Company, User, CaseApplication, ProjectTeam, ProjectComment, StudentProject, ProjectMilestone } from '../types/models'
// Backend DTOs are intentionally converted at the API boundary.
export function fromUser(d: any): User {
 const s=d.student
 d={...d,roles:(d.roles || []).map((r:string)=>({company_representative:'company',university_staff:'curator'} as any)[r] || r)}
 return {id:d.user_id, username:d.username, email:d.email, fullName:s?[s.last_name,s.first_name,s.patronymic].filter(Boolean).join(' '):d.username, role:['admin','company_representative','company','curator','university','student'].find(r=>d.roles?.includes(r)) as User['role'] || 'student', isBlocked:d.status==='blocked', createdAt:d.created_at, ...(s?{studentProfile:{university:s.university || '', institute:s.institute || '', fieldOfStudy:s.direction || '', educationalProgram:s.program || '', course:s.course, group:s.group_name || '', bio:s.bio || '', interests:s.professional_interests || [], skills:s.competencies || [], techStack:s.technologies || [], educationLevel:({bachelor:'Бакалавриат',specialist:'Специалитет',master:'Магистратура',postgraduate:'Аспирантура'} as any)[s.education_level] || s.education_level,links:s.links || [],githubUrl:s.links?.find((l:any)=>l.kind==='github')?.url || '',gitlabUrl:s.links?.find((l:any)=>l.kind==='gitlab')?.url,portfolioUrl:s.links?.find((l:any)=>l.kind==='portfolio')?.url,phone:s.phone || '',rating:0,verifiedProjectsCount:0,winsCount:0}}:{})}
}
export function fromCompany(d:any):Company {return {id:d.company_id,name:d.full_name,shortName:d.short_name || d.full_name,description:d.description || '',industry:d.industry || '',website:d.website || '',logo:d.logo_file_id?`/api/v1/companies/${d.company_id}/logo`:'',email:d.contacts || '',phone:'',contactPerson:'',directions:[],techStack:[],activeCasesCount:0,completedProjectsCount:0,isBlocked:d.status==='suspended',isVerified:d.status==='approved',isModerated:d.status==='approved'}}
const caseSources=new Map<string,any>()
export function fromCase(d:any):CaseProject {caseSources.set(d.case_id,d)
 const kind=d.event_format==='hackathon'||d.event_format==='olympiad'?d.event_format:'case'
 const criteria=(d.evaluation_criteria || []).map((c:any)=>({id:c.criterion_id,label:c.name,weight:1,maxScore:c.max_score}))
 const specification=d.files?.find((f:any)=>f.visibility==='public')
 return {kind,olympiadTasks:kind==='olympiad'?criteria.map((c:any)=>({id:c.id,title:c.label,maxScore:c.maxScore})):undefined,
 olympiadRules:kind==='olympiad'?d.evaluation_rules:undefined,
 coverFileId:d.cover_file_id || undefined,coverUrl:d.cover_file_id?`/api/v1/cases/${d.case_id}/cover`:undefined,
 specificationFile:specification?{name:specification.original_name,file_id:specification.file_id,url:`/api/v1/cases/${d.case_id}/files/${specification.file_id}`}:undefined,
 id:d.case_id,companyId:d.company_id,companyName:d.company_name || '',companyLogo:'',title:d.title,shortDescription:d.summary,fullDescription:d.full_brief,direction:d.directions?.[0]?.name || '',complexity:({beginner:'Начальный',intermediate:'Средний',advanced:'Высокий'} as any)[d.difficulty] || 'Средний',participationFormat:d.participation_mode,teamSize:{min:d.team_size_min || 1,max:d.team_size_max || 1},maxTeams:d.capacity,requiredCompetencies:(d.required_competencies || []).map((v:any)=>v.name),recommendedTech:(d.technologies || []).map((v:any)=>v.name),deadlineDate:(d.due_at || d.application_deadline || '').slice(0,10),duration:d.duration || '',workFormat:({remote:'дистанционный',onsite:'очный',hybrid:'смешанный'} as const)[d.work_format as 'remote'] || 'дистанционный',resultRequirements:d.result_requirements,evaluationOrder:d.evaluation_rules || '',evaluationCriteria:criteria,rewardType:({paid:'monetary',other_reward:'other'} as any)[d.type] || d.type,prizeFund:d.rewards?.find((r:any)=>r.prize_fund!=null)?.prize_fund,rewardAmount:d.rewards?.find((r:any)=>r.amount!=null)?.amount,rewardDescription:d.rewards?.[0]?.description || '',paymentStatus:'not_provided',status:d.status==='published'?'open':d.status,isConfidential:d.nda_required,ipRights:'custom_agreement',ipRightsDescription:d.ip_terms,applicationDeadline:d.application_deadline,registrationsCount:d.registrations_count,viewsCount:d.views_count || 0,applicationsCount:kind==='case'?(d.applications_count || 0):(d.registrations_count || 0),publishedAt:d.created_at,moderationStatus:({published:'approved',in_progress:'approved',completed:'approved',draft:'pending',moderation:'pending',cancelled:'hidden'} as any)[d.status] || d.status,isModerated:['published','in_progress','completed'].includes(d.status)}}
export function toCase(d:CaseProject) {
 const source=caseSources.get(d.id)
 const eventFormat=d.kind==='hackathon'||d.kind==='olympiad'?d.kind:'case'
 const criteria=eventFormat==='olympiad'&&d.olympiadTasks
   ? d.olympiadTasks.map(task=>({label:task.title,maxScore:task.maxScore}))
   : d.evaluationCriteria || []
 const files=(source?.files || []).map((file:any)=>({file_id:file.file_id,visibility:file.visibility}))
 const specificationId=d.specificationFile?.file_id
 if(specificationId&&!files.some((file:any)=>file.file_id===specificationId)){
   const previous=files.findIndex((file:any)=>file.visibility==='public')
   if(previous>=0)files.splice(previous,1)
   files.unshift({file_id:specificationId,visibility:'public'})
 }
 return {
   company_id:d.companyId,title:d.title,summary:d.shortDescription,full_brief:d.fullDescription,
   type:({monetary:'paid',other:'other_reward'} as any)[d.rewardType] || d.rewardType,event_format:eventFormat,
   difficulty:({'Начальный':'beginner','Средний':'intermediate','Высокий':'advanced'} as const)[d.complexity],
   direction_ids:source?.directions?.map((x:any)=>x.id) || [],
   technology_ids:source?.technologies?.map((x:any)=>x.id) || [],
   required_competencies:source?.required_competencies?.map((x:any)=>({id:x.id,required_level:x.required_level || ''})) || [],
   rewards:d.rewardDescription?[{kind:d.rewardType==='monetary'?'money':'prize',description:d.rewardDescription,amount:d.rewardAmount ?? null,prize_fund:d.prizeFund ?? null,currency:'RUB',prize_places:[]}]:[],
   work_format:({'дистанционный':'remote','очный':'onsite','смешанный':'hybrid'} as const)[d.workFormat],
   participation_mode:d.participationFormat,
   admission_mode:source?.admission_mode || (eventFormat==='case'?'selection':'open'),
   capacity:d.maxTeams,team_size_min:d.teamSize.min,team_size_max:d.teamSize.max,
   course_min:source?.course_min,course_max:source?.course_max,application_deadline:d.applicationDeadline || source?.application_deadline,
   due_at:d.deadlineDate?`${d.deadlineDate}T23:59:59Z`:null,duration:d.duration,
   result_requirements:d.resultRequirements,evaluation_rules:d.olympiadRules || d.evaluationOrder,
   ip_terms:d.ipRightsDescription || d.ipRights,nda_required:d.isConfidential,visibility:source?.visibility || 'public',
   evaluation_criteria:criteria.map((c,i)=>({name:c.label,max_score:c.maxScore || 10,ordinal:i+1})),files,
 }
}
export async function collectPages<T>(get:(params:any)=>Promise<{data:any}>,params:any={}):Promise<T[]> {
 const items:T[]=[]; let cursor:string|undefined; const seen=new Set<string>()
 do {const {data}=await get({...params,limit:100,...(cursor?{cursor}:{})}); if(Array.isArray(data))return data; if(!Array.isArray(data.items))throw new Error('Некорректный ответ списка API'); items.push(...data.items); cursor=data.meta?.has_more?data.meta.next_cursor:undefined; if(cursor&&seen.has(cursor))throw new Error('API повторил курсор страницы'); if(cursor)seen.add(cursor)}while(cursor)
 return items
}

export const fromApplication=(d:any):CaseApplication=>({id:d.application_id,caseId:d.case_id,caseTitle:d.case_title,companyId:d.company_id,studentId:d.student_id || d.submitted_by,studentName:d.student_name || '',studentEmail:'',studentPhone:'',studentCourse:0,studentInstitute:'',teamId:d.team_id || undefined,teamName:d.team_name,applicantType:d.team_id?'team':'individual',coverLetter:d.cover_letter || '',resumeUrl:d.resume_file_id?`/api/v1/applications/${d.application_id}/resume`:'',portfolioUrl:d.portfolio_url || '',githubUrl:d.github_url || '',previousProjects:[],consentPending:d.status==='consent_pending',isRegistration:d.entry_kind==='registration',status:({consent_pending:'pending',submitted:'pending',info_requested:'need_info',interview_scheduled:'interview'} as any)[d.status] || d.status,companyNotes:d.company_notes,createdAt:d.submitted_at})
export const fromTeam=(d:any):ProjectTeam=>({id:d.team_id,name:d.name,leaderId:d.leader_id,leaderName:(d.members || []).find((m:any)=>m.student_id===d.leader_id)?.name || '',members:(d.members || []).filter((m:any)=>!m.left_at).map((m:any)=>({id:m.student_id,name:m.name,role:m.role_name || (m.student_id===d.leader_id?'Капитан':'Участник'),competencies:[]})),createdAt:d.created_at})
export const fromComment=(d:any):ProjectComment=>({id:d.comment_id,caseId:d.resource_id,authorId:d.author_id,authorName:d.author_name || '',authorRole:'student',content:d.status==='deleted'?'Комментарий удалён':d.body,parentId:d.parent_comment_id || undefined,createdAt:d.created_at,likedBy:[],likesCount:d.likes_count,likedByMe:d.liked_by_me})
export const fromStage=(d:any,caseId:string):ProjectMilestone=>({id:d.stage_id,caseId,stepNumber:d.ordinal,title:d.title,description:d.expected_result || '',deadline:(d.due_at || '').slice(0,10),status:({in_progress:'pending',completed:'accepted',revision:'needs_work'} as any)[d.status] || d.status || 'pending',attachedMaterials:[],feedback:d.feedback})
export const fromStudent=(d:any):User=>fromUser({user_id:d.user_id,username:d.username,email:'',roles:['student'],status:'active',created_at:d.created_at,student:{first_name:d.full_name,institute:d.institute,direction:d.direction,course:d.course,competencies:d.competencies,technologies:d.technologies}})
export const fromProject=(d:any):StudentProject=>({id:d.project_id,authorId:d.owner_id,authorName:d.owner_name || '',title:d.title,category:({coursework:'курсовой',pet_project:'pet-проект',startup:'стартап',research:'НИР',hackathon:'хакатон',other:'учебный'} as const)[d.category as 'coursework'] || 'учебный',shortDescription:d.short_description,fullDescription:d.full_description,problemSolved:d.problem_solved || '',coverImage:d.cover_file_id?`/api/v1/student-projects/${d.project_id}/files/${d.cover_file_id}`:'',technologies:d.tags || [],direction:'' as any,createdAt:d.created_at,status:'в разработке',githubUrl:d.github_url,productUrl:d.product_url,screenshots:[],badges:[],isModerated:d.status==='published',moderationStatus:({published:'approved',draft:'pending',moderation:'pending'} as any)[d.status] || d.status,moderationComment:d.moderation_comment,visibility:d.visibility,likedByMe:!!d.liked_by_me,likesCount:d.likes_count || 0})
export async function collectNumbered<T>(get:(params:any)=>Promise<{data:any}>,params:any={}):Promise<T[]>{const result:T[]=[];for(let page=1;;page++){const {data}=await get({...params,page,page_size:100});if(!Array.isArray(data.items))throw new Error('Некорректный ответ списка API');result.push(...data.items);if(data.items.length<100 || (data.meta?.total!==undefined && result.length>=data.meta.total))return result}}
