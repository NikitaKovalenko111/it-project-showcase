import { CaseProject } from '../types/models'
export const openRegistration = (project: Pick<CaseProject, 'kind'>) => ['olympiad', 'hackathon'].includes(project.kind || '')
export const scoringItems = (project: CaseProject) => project.kind === 'olympiad'
  ? (project.olympiadTasks || []).map(task => ({id:task.id,label:task.title,max:task.maxScore,weight:1}))
  : (project.evaluationCriteria || []).map(c => ({...c,max:c.maxScore ?? 10}))
