import { collectPages, fromStage, fromTeam } from './backend'
import type { Execution } from '../types/execution'
import type { ProjectMilestone } from '../types/models'
type CaseStageDTO = {
  stage_id: string
  ordinal: number
  title: string
  expected_result?: string
  due_at?: string
}
type PlanRow = Pick<ProjectMilestone, 'id' | 'title' | 'description' | 'deadline'>
type ExecutionReference = { execution_id: string; case_id: string }
// Injecting transport keeps API payloads testable without a browser or mock storage.
export function createWorkflow(http: any) {
  const items = async (path: string, params?: any) =>
    (await http.get(path, { params })).data.items || []
  const base = (http.defaults?.baseURL || '/api/v1').replace(/\/$/, '')
  const files = (xs: any[], submissionId: string) =>
    (xs || []).map((f) => ({
      name: f.original_name || `Файл ${f.ordinal || ''}`.trim(),
      mimeType: f.mime_type,
      kind: f.kind,
      size: f.size_bytes ? `${Math.ceil(f.size_bytes / 1024)} КБ` : undefined,
      file_id: f.file_id,
      url: `${base}/submissions/${submissionId}/files/${f.file_id}`,
    }))
  const submission = (d: any, caseId: string) =>
    d
      ? {
          id: d.submission_id,
          caseId,
          studentId: d.submitted_by,
          authorName: '',
          description: d.description,
          repoUrl: d.repository_url || '',
          demoUrl: d.demo_url || undefined,
          screenshots: [],
          attachedFiles: files(d.files, d.submission_id),
          submittedAt: d.submitted_at,
        }
      : undefined
  const evaluation = (d: any, caseId: string) =>
    d
      ? {
          id: d.evaluation_id,
          caseId,
          companyId: '',
          companyName: '',
          evaluatorId: d.evaluator_id,
          evaluatorName: 'Представитель компании',
          scores: Object.fromEntries((d.scores || []).map((s: any) => [s.criterion_id, s.score])),
          totalScore: d.total_score,
          maxScore: d.max_score,
          feedback: d.feedback || '',
          evaluatedAt: d.created_at,
        }
      : undefined
  const getExecution = async (id: string): Promise<Execution> => {
    const d = (await http.get(`/executions/${id}`)).data
    const [stages, submissions] = await Promise.all([
      items(`/executions/${id}/stages`),
      collectPages<any>((params) => http.get(`/executions/${id}/submissions`, { params })),
    ])
    const latest = submissions.find((s) => s.kind === 'final' && s.status !== 'superseded')
    const evaluations = latest
      ? await items(`/submissions/${latest.submission_id}/evaluations`)
      : []
    const graded = evaluations[0]
    return {
      id: d.execution_id,
      caseId: d.case_id,
      applicationId: d.application_id,
      teamId: d.team_id || undefined,
      name: d.team_name || d.members?.map((m: any) => m.name).join(', ') || d.case_title,
      members: (d.members || [])
        .filter((m: any) => !m.left_at)
        .map((m: any) => ({
          id: m.student_id,
          name: m.name,
          role: m.role_name || 'Участник',
          competencies: [],
        })),
      status: graded ? 'evaluated' : latest ? 'submitted' : 'active',
      canSubmitResult: ['accepted', 'in_progress', 'revision', 'done', 'submitted'].includes(
        d.status,
      ),
      submission: submission(latest, d.case_id),
      evaluation: evaluation(graded, d.case_id),
      milestones: stages.map((s: any) => ({
        ...fromStage(s, d.case_id),
        attachedMaterials:
          submission(
            submissions.find(
              (x) => x.kind === 'stage' && x.stage_id === s.stage_id && x.status !== 'superseded',
            ),
            d.case_id,
          )?.attachedFiles || [],
      })),
    }
  }
  const getExecutions = async (caseId: string): Promise<Execution[]> => {
    const apps = await collectPages<any>((params) => http.get('/applications', { params }), {
      case_id: caseId,
    })
    return Promise.all(
      [...new Set(apps.map((a) => a.execution_id).filter(Boolean))].map((id) => getExecution(id)),
    )
  }
  const listCuratedExecutions = async (caseId?: string) => {
    const items = await collectPages<ExecutionReference>((params) =>
      http.get('/executions', { params }),
    )
    return caseId ? items.filter((item) => item.case_id === caseId) : items
  }
  const getCuratedExecutions = async (caseId?: string) =>
    Promise.all(
      (await listCuratedExecutions(caseId)).map((item) => getExecution(item.execution_id)),
    )
  const send = async (
    executionId: string,
    description: string,
    attachments: any[],
    stageId?: string,
    demoUrl?: string,
  ) => {
    const state = (await http.get(`/executions/${executionId}`)).data
    if (state.status === 'accepted')
      await http.patch(`/executions/${executionId}/status`, { status: 'in_progress' })
    if (stageId) {
      const stage = (await items(`/executions/${executionId}/stages`)).find(
        (s: any) => s.stage_id === stageId,
      )
      if (stage && ['pending', 'revision'].includes(stage.status))
        await http.patch(`/executions/${executionId}/stages/${stageId}`, {
          status: 'in_progress',
          feedback: '',
        })
    }
    const payload = {
      kind: stageId ? 'stage' : 'final',
      title: stageId ? 'Результат этапа' : 'Итоговое решение',
      description,
      stage_id: stageId || '',
      demo_url: demoUrl || '',
      files: attachments.map((f, i) => {
        if (!f.file_id) throw new Error('Загрузите файл на сервер перед отправкой')
        return {
          file_id: f.file_id,
          kind: f.kind === 'screenshot' ? 'screenshot' : 'attachment',
          ordinal: i + 1,
        }
      }),
    }
    await http.post(`/executions/${executionId}/submissions`, payload)
  }
  const updateSharedPlan = async (
    caseId: string,
    rows: PlanRow[],
    baseline?: PlanRow[],
    reason = '',
  ) => {
    const path = `/cases/${caseId}/stages`
    const before: CaseStageDTO[] = await items(path)
    const byId = new Map(before.map((stage) => [stage.stage_id, stage]))
    if (
      baseline &&
      (before.length !== baseline.length ||
        before.some((stage, i) => {
          const row = baseline[i]
          return (
            row.id !== stage.stage_id ||
            row.title !== stage.title ||
            row.description !== (stage.expected_result || '') ||
            row.deadline !== (stage.due_at || '').slice(0, 10)
          )
        }))
    )
      throw new Error('План изменился на сервере. Проверьте актуальные этапы перед сохранением.')
    if (rows.some((row) => !row.id.startsWith('plan_') && !byId.has(row.id)))
      throw new Error('План изменился на сервере. Откройте его заново.')
    const previous = before.map((stage) => ({
      stage_id: stage.stage_id,
      title: stage.title,
      expected_result: stage.expected_result || '',
      due_at: stage.due_at || null,
    }))
    const stages = rows.map((row) => {
      const old = byId.get(row.id)
      return {
        stage_id: old?.stage_id || '',
        title: row.title,
        expected_result: row.description,
        due_at:
          old && (old.due_at || '').slice(0, 10) === row.deadline
            ? old.due_at || null
            : row.deadline
              ? `${row.deadline}T23:59:59Z`
              : null,
      }
    })
    const { data } = await http.put(path, { previous, stages, reason: reason.trim() })
    return data.items.map((stage: any) => fromStage(stage, caseId))
  }
  return {
    withdrawResults: async (caseId: string) => {
      await http.delete(`/cases/${caseId}/leaderboard/placements`)
    },
    getExecution,
    getExecutions,
    updateSharedPlan,
    listCuratedExecutions,
    getCuratedExecutions,
    getSharedPlan: async (caseId: string) =>
      (await items(`/cases/${caseId}/stages`)).map((s: any) => fromStage(s, caseId)),
    submitExecution: async (
      id: string,
      description: string,
      attachments: any[],
      demoUrl?: string,
    ) => {
      await send(id, description, attachments, undefined, demoUrl)
      return getExecution(id)
    },
    gradeExecution: async (id: string, scores: Record<string, number>, feedback: string) => {
      const entry = await getExecution(id)
      if (!entry.submission) throw new Error('Работа ещё не сдана')
      await http.post(`/submissions/${entry.submission.id}/evaluations`, {
        feedback,
        scores: Object.entries(scores).map(([criterion_id, score]) => ({ criterion_id, score })),
      })
      return getExecution(id)
    },
    updateExecutionStage: async (
      id: string,
      stageId: string,
      action: string,
      attachments: any[] = [],
      feedback = '',
      fileIndex = -1,
      fileId?: string,
    ) => {
      if (action === 'remove') {
        if (!fileId) throw new Error('Не найден идентификатор файла. Обновите работу.')
        const submissions = await collectPages<any>((params) =>
          http.get(`/executions/${id}/submissions`, { params }),
        )
        const current = submissions.find(
          (s) => s.kind === 'stage' && s.stage_id === stageId && s.status !== 'superseded',
        )
        if (!current || !current.files?.some((file: any) => file.file_id === fileId))
          throw new Error('Материалы этапа изменились. Обновите работу.')
        await http.delete(`/submissions/${current.submission_id}/files/${fileId}`)
        return getExecution(id)
      }
      if (action === 'submit') await send(id, feedback || 'Материалы этапа', attachments, stageId)
      await http.patch(`/executions/${id}/stages/${stageId}`, {
        status: action === 'needs_work' ? 'revision' : action === 'submit' ? 'submitted' : action,
        feedback,
      })
      return getExecution(id)
    },
    getLeaderboard: async (caseId: string) => {
      const rows = await items(`/cases/${caseId}/leaderboard`)
      return {
        complete: rows.some((r: any) => Number.isInteger(r.place_no) && r.place_no > 0),
        items: rows.map((r: any) => ({
          id: r.execution_id,
          name: r.team_name || 'Участник',
          score: r.total_score,
          max: r.max_score,
          place: r.place_no || undefined,
        })),
      }
    },
    finalizeResults: async (caseId: string) => {
      const rows = await items(`/cases/${caseId}/leaderboard`)
      if (!rows.length || rows.some((row: any) => row.evaluation_status !== 'published'))
        throw new Error('Оцените работы всех участников перед публикацией итогов.')
      await http.put(`/cases/${caseId}/leaderboard/placements`, {
        placements: rows.map((r: any, i: number) => ({
          execution_id: r.execution_id,
          place_no: i + 1,
        })),
      })
    },
  }
}
