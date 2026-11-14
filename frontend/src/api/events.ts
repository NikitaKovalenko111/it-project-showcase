import { apiRuntime } from './runtime'
import { mockServer } from './mockServer'
import { canManageCase } from '../utils/access'
import { axiosInstance } from './http'

export type EventTask = {
  task_id?: string
  title: string
  statement: string
  file_ids: string[]
  max_score: number
}
export type EventRound = {
  round_id?: string
  title: string
  opens_at: string
  due_at: string
  rules?: string
  tasks: EventTask[]
}
export type EventPlan = {
  subject: string
  time_zone: string
  venue_name?: string
  address?: string
  building?: string
  room?: string
  platform_name?: string
  platform_url?: string
  regulations?: string
  agenda?: string
  defense_at?: string
  rounds: EventRound[]
}
export type EventSolution = { task_id: string; text?: string; url?: string; file_id?: string }
export type EventScore = { task_id: string; score: number }
export type RoundSubmission = {
  round_id: string
  solutions: EventSolution[]
  scores: EventScore[]
  total_score: number | null
  max_score: number | null
  evaluator_name?: string
}
export const getEventPlan = async (id: string): Promise<EventPlan> => {
  if (apiRuntime.mode === 'live')
    return (await axiosInstance.get<EventPlan>(`/cases/${id}/event-plan`)).data
  const project = mockServer.getCaseById(id)
  if (!project) throw new Error('Проект недоступен.')
  const stored = JSON.parse(localStorage.getItem('showcase_curated_v1_event_plans') || '{}')
  return (
    stored[id] || {
      subject: project.title,
      time_zone: 'Asia/Yekaterinburg',
      venue_name: 'Проектная лаборатория университета',
      address: 'Учебный корпус, центр проектной деятельности',
      building: 'Главный корпус',
      room: 'Аудитория 204',
      platform_name: 'Онлайн-площадка мероприятия',
      platform_url: 'https://meet.jit.si/showcase-' + id,
      regulations:
        'Участники работают самостоятельно в своих командах. На установочной встрече организатор объясняет задачу, правила работы с учебными данными и критерии оценки. Вопросы по решению обсуждаются в пространстве команды; материалы других команд недоступны участникам. На защите необходимо показать воспроизводимый запуск, объяснить принятые решения и ограничения.',
      agenda:
        '10:00 — открытие и разбор задания\n11:00 — работа команд и консультации\n15:00 — промежуточная демонстрация\n17:00 — защита решений и вопросы экспертов',
      defense_at: '2027-06-30T12:00:00Z',
      rounds:
        project.kind === 'olympiad'
          ? [
              {
                round_id: id + '_round',
                title: 'Основной тур',
                opens_at: '2027-06-30T07:00:00Z',
                due_at: '2027-06-30T10:00:00Z',
                rules:
                  'Индивидуальные решения. Приложите алгоритм, оценку сложности и исходный код.',
                tasks: (project.olympiadTasks || []).map((task) => ({
                  task_id: task.id,
                  title: task.title,
                  statement:
                    'Ознакомьтесь с ограничениями, подготовьте решение и проверьте граничные случаи.',
                  file_ids: [],
                  max_score: task.maxScore,
                })),
              },
            ]
          : [],
    }
  )
}
export const saveEventPlan = async (id: string, plan: EventPlan) => {
  if (apiRuntime.mode === 'live') return axiosInstance.put(`/cases/${id}/event-plan`, plan)
  const user = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
  const project = mockServer.getCaseById(id)
  if (!project || !canManageCase(user, project))
    throw new Error('Нет прав на изменение мероприятия.')
  const stored = JSON.parse(localStorage.getItem('showcase_curated_v1_event_plans') || '{}')
  localStorage.setItem('showcase_curated_v1_event_plans', JSON.stringify({ ...stored, [id]: plan }))
  return { data: plan }
}
export const getRoundSubmissions = async (id: string) =>
  (
    await axiosInstance.get<{ items: RoundSubmission[]; total_score: number }>(
      `/executions/${id}/round-submissions`,
    )
  ).data
export const submitRound = (id: string, round: string, solutions: EventSolution[]) =>
  axiosInstance.post(`/executions/${id}/rounds/${round}/submission`, { solutions })
export const gradeRound = (id: string, round: string, scores: EventScore[]) =>
  axiosInstance.put(`/executions/${id}/rounds/${round}/evaluation`, { scores })
