import { axiosInstance } from './client'
import { apiRuntime } from './runtime'
import { mockServer, MockServer } from './mockServer'

type CommunityMethod = 'reportContent' | 'getReports' | 'resolveReport' | 'setStudentProjectVisibility' | 'updateCompanyContent' | 'assignStudentCurator' | 'likeComment' | 'getTeamRequests' | 'requestTeam' | 'decideTeamRequest' | 'getSeekers' | 'saveSeeker' | 'linkTeamToCase' | 'getInvitation' | 'respondInvitation'
type AsyncMethods = { [K in CommunityMethod]: (...args: Parameters<MockServer[K]>) => Promise<ReturnType<MockServer[K]>> }

// Live contract: POST /community/<method> with { args }, returning the method result.
// Missing endpoints surface an error; live mode never writes to mock storage.
export const communityApi = new Proxy({} as AsyncMethods, {
  get: (_target, key: CommunityMethod) => async (...args: unknown[]) => {
    if (apiRuntime.mode === 'live') return (await axiosInstance.post(`/community/${key}`, { args })).data
    return Reflect.apply(mockServer[key], mockServer, args)
  },
})
