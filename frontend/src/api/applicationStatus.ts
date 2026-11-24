import type { AxiosInstance } from 'axios'
import type { ApplicationStatus, CaseApplication } from '../types/models'
import { fromApplication } from './backend'

export class ApplicationStatusConflict extends Error {
  constructor(
    readonly application: CaseApplication,
    message: string,
  ) {
    super(message)
  }
}

export async function patchApplicationStatus(
  http: Pick<AxiosInstance, 'get' | 'patch'>,
  appId: string,
  status: ApplicationStatus,
  notes?: string,
) {
  const path = `/applications/${appId}`
  try {
    const { data } = await http.patch(`${path}/status`, {
      status: status === 'need_info' ? 'info_requested' : status,
      notes,
    })
    return { application: fromApplication(data), changed: true }
  } catch (error) {
    const cause = error as Error & { code?: string }
    if (cause.code !== 'invalid_application_transition') throw error

    const latest = await http.get(path).catch(() => undefined)
    if (!latest) throw error

    const application = fromApplication(latest.data)
    if (application.status === status) return { application, changed: false }
    throw new ApplicationStatusConflict(application, cause.message)
  }
}
