import { createId } from '../utils/id'
import { buildPrograms, buildProgramApplications } from './fixtures/programs'
import { axiosInstance } from './http'
import { apiRuntime } from './runtime'
import { collectNumbered } from './backend'
import { mockServer } from './mockServer'
import type { User } from '../types/models'

export type OpportunityKind = 'internship' | 'practice'
export type Opportunity = {
  program_id: string
  kind: OpportunityKind
  company_id: string
  company_name: string
  title: string
  summary: string
  content_markdown: string
  capacity: number | null
  application_deadline: string | null
  moderation_comment?: string
  status: string
}
export type OpportunityApplication = {
  application_id: string
  program_id: string
  student_id: string
  cover_letter: string
  resume_file_id?: string
  resume_url?: string
  status: 'submitted' | 'accepted' | 'rejected' | 'withdrawn'
  created_at: string
  program_title?: string
  program_kind?: OpportunityKind
  student_name?: string
}

const live = apiRuntime.mode === 'live'
const seed = buildPrograms()
function read<T>(key: string, fallback: T): T {
  const data = localStorage.getItem('showcase_curated_v1_' + key)
  return data ? JSON.parse(data) : structuredClone(fallback)
}
function save<T>(key: string, data: T) {
  localStorage.setItem('showcase_curated_v1_' + key, JSON.stringify(data))
}
const programs = () => {
  const rows = read('opportunities', seed)
  if (!read('program_details_20261114_v2', false)) {
    const legacy = buildPrograms(false)
    for (const row of rows) {
      const old = legacy.find((item) => item.program_id === row.program_id),
        next = seed.find((item) => item.program_id === row.program_id)
      if (old && next && row.content_markdown === old.content_markdown)
        row.content_markdown = next.content_markdown
    }
    save('opportunities', rows)
    save('program_details_20261114_v2', true)
  }
  return rows
}
const applications = () =>
  read<OpportunityApplication[]>('opportunity_applications', buildProgramApplications())
function actor() {
  const session = JSON.parse(localStorage.getItem('uust_current_user') || 'null') as User | null
  const user = session && mockServer.getUserById(session.id)
  if (!user || user.isBlocked) throw new Error('Войдите в аккаунт.')
  return user
}
const owns = (user: User, companyId: string) =>
  user.role === 'company' && user.companyProfile?.companyId === companyId
const available = (program: Opportunity) =>
  program.status === 'published' &&
  (!program.application_deadline || Date.parse(program.application_deadline) > Date.now())

export const opportunityApi = {
  async list(scope: 'mine' | 'public' | 'moderation') {
    if (live) {
      const path = scope === 'public' ? '/internships' : '/internships/' + scope
      return collectNumbered<Opportunity>((params) => axiosInstance.get(path, { params }))
    }
    const user = actor()
    return programs().filter((item) => {
      if (scope === 'public') return item.status === 'published'
      if (scope === 'mine') return owns(user, item.company_id)
      return user.role === 'admin'
        ? ['moderation', 'published', 'closed', 'hidden'].includes(item.status)
        : ['curator', 'university'].includes(user.role) && item.status === 'moderation'
    })
  },

  async save(
    programId: string | undefined,
    payload: Partial<Opportunity> & { kind: OpportunityKind },
  ) {
    if (live) {
      const { data } = programId
        ? await axiosInstance.put<Opportunity>('/internships/' + programId, payload)
        : await axiosInstance.post<Opportunity>('/internships', payload)
      return data
    }
    const rows = programs()
    const previous = rows.find((row) => row.program_id === programId)
    const user = actor()
    const companyId = previous?.company_id || payload.company_id || ''
    const company = mockServer.getCompanyById(companyId)
    if (
      !company ||
      (!owns(user, companyId) && user.role !== 'admin') ||
      (programId && (!previous || !['draft', 'revision', 'published'].includes(previous.status)))
    )
      throw new Error('Программа недоступна для редактирования.')
    if (!payload.title?.trim() || !payload.summary?.trim())
      throw new Error('Укажите название и описание программы.')
    const item: Opportunity = {
      ...previous,
      program_id: previous?.program_id || createId(),
      kind: previous?.kind || payload.kind,
      company_id: companyId,
      company_name: company.name,
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      content_markdown: payload.content_markdown || '',
      capacity: payload.capacity ?? null,
      application_deadline: payload.application_deadline || null,
      status: previous?.status === 'published' ? 'revision' : previous?.status || 'draft',
    }
    save('opportunities', [item, ...rows.filter((row) => row.program_id !== item.program_id)])
    return item
  },

  async setStatus(id: string, status: string, comment: string) {
    if (apiRuntime.mode === 'live' && status === 'draft')
      throw new Error('Сервер пока не поддерживает отзыв программы с модерации.')

    if (live)
      return (
        await axiosInstance.patch<Opportunity>(`/internships/${id}/status`, { status, comment })
      ).data
    const rows = programs()
    const item = rows.find((row) => row.program_id === id)
    const user = actor()
    if (!item) throw new Error('Программа не найдена.')
    const moderator = ['admin', 'curator', 'university'].includes(user.role)
    const allowed =
      (status === 'draft' && item.status === 'moderation' && owns(user, item.company_id)) ||
      (status === 'moderation' &&
        ['draft', 'revision'].includes(item.status) &&
        (owns(user, item.company_id) || user.role === 'admin')) ||
      (status === 'closed' && item.status === 'published' && owns(user, item.company_id)) ||
      (item.status === 'moderation' && moderator && ['published', 'revision'].includes(status)) ||
      (user.role === 'admin' &&
        ['published', 'closed'].includes(item.status) &&
        status === 'hidden')
    if (!allowed) throw new Error('Этот переход статуса недоступен.')
    if (['revision', 'hidden'].includes(status) && !comment.trim())
      throw new Error('Укажите причину.')
    item.status = status
    item.moderation_comment = comment.trim()
    save('opportunities', rows)
    return item
  },

  async listApplications(programId?: string) {
    if (live) {
      const path = programId
        ? `/internships/${programId}/applications`
        : '/internships/applications/mine'
      return collectNumbered<OpportunityApplication>((params) =>
        axiosInstance.get(path, { params }),
      )
    }
    const user = actor()
    const program = programs().find((item) => item.program_id === programId)
    if (programId && (!program || !owns(user, program.company_id)))
      throw new Error('Нет доступа к заявкам программы.')
    return applications().filter((item) =>
      programId ? item.program_id === programId : item.student_id === user.id,
    )
  },

  async apply(id: string, coverLetter: string, resumeFileId?: string, resumeUrl?: string) {
    if (live) {
      await axiosInstance.post(`/internships/${id}/applications`, {
        cover_letter: coverLetter,
        resume_file_id: resumeFileId,
      })
      return
    }
    const user = actor()
    const program = programs().find((item) => item.program_id === id)
    const rows = applications()
    if (
      user.role !== 'student' ||
      !program ||
      !available(program) ||
      (program.capacity != null &&
        rows.filter((row) => row.program_id === id && row.status === 'accepted').length >=
          program.capacity)
    )
      throw new Error('Приём заявок закрыт или все места заняты.')
    if (
      rows.some(
        (row) =>
          row.program_id === id &&
          row.student_id === user.id &&
          !['withdrawn', 'rejected'].includes(row.status),
      )
    )
      throw new Error('У вас уже есть заявка на эту программу.')
    save('opportunity_applications', [
      {
        application_id: createId(),
        program_id: id,
        program_title: program.title,
        program_kind: program.kind,
        student_id: user.id,
        student_name: user.fullName,
        cover_letter: coverLetter,
        resume_url: resumeUrl,
        status: 'submitted',
        created_at: new Date().toISOString(),
      } satisfies OpportunityApplication,
      ...rows,
    ])
  },

  async decide(id: string, status: 'accepted' | 'rejected' | 'withdrawn') {
    if (live)
      return (
        await axiosInstance.patch<OpportunityApplication>(
          `/internships/applications/${id}/status`,
          { status },
        )
      ).data
    const user = actor()
    const rows = applications()
    const item = rows.find((row) => row.application_id === id)
    const program = programs().find((row) => row.program_id === item?.program_id)
    if (
      !item ||
      !program ||
      item.status !== 'submitted' ||
      !(status === 'withdrawn' ? item.student_id === user.id : owns(user, program.company_id))
    )
      throw new Error('Действие недоступно.')
    if (
      status === 'accepted' &&
      program.capacity != null &&
      rows.filter((row) => row.program_id === program.program_id && row.status === 'accepted')
        .length >= program.capacity
    )
      throw new Error('Все места заняты.')
    item.status = status
    save('opportunity_applications', rows)
    return item
  },
}
