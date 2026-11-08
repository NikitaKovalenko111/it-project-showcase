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
export const getEventPlan = async (id: string) =>
  (await axiosInstance.get<EventPlan>(`/cases/${id}/event-plan`)).data
export const saveEventPlan = (id: string, plan: EventPlan) =>
  axiosInstance.put(`/cases/${id}/event-plan`, plan)
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
