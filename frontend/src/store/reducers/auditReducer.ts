import { AuditLog } from '../../types/models'
import * as types from '../types'

export interface AuditState {
  auditLogs: AuditLog[]
  loading: boolean
}

const initialState: AuditState = {
  auditLogs: [],
  loading: false,
}

export const auditReducer = (state = initialState, action: any): AuditState => {
  switch (action.type) {
    case types.FETCH_AUDIT_LOGS_REQUEST:
      return { ...state, loading: true }

    case types.FETCH_AUDIT_LOGS_SUCCESS:
      return { ...state, loading: false, auditLogs: action.payload.auditLogs }

    default:
      return state
  }
}
