import { CaseApplication } from '../../types/models'
import * as types from '../types'

export interface ApplicationsState {
  applicationsList: CaseApplication[]
  loading: boolean
  error: string | null
}

const initialState: ApplicationsState = {
  applicationsList: [],
  loading: false,
  error: null,
}

export const applicationsReducer = (state = initialState, action: any): ApplicationsState => {
  switch (action.type) {
    case types.FETCH_APPLICATIONS_REQUEST:
    case types.CREATE_APPLICATION_REQUEST:
    case types.UPDATE_APPLICATION_STATUS_REQUEST:
      return { ...state, loading: true, error: null }

    case types.FETCH_APPLICATIONS_SUCCESS:
      return { ...state, loading: false, applicationsList: action.payload.applications }

    case types.CREATE_APPLICATION_SUCCESS:
      return {
        ...state,
        loading: false,
        applicationsList: [action.payload.application, ...state.applicationsList],
      }

    case types.UPDATE_APPLICATION_STATUS_SUCCESS:
      return {
        ...state,
        loading: false,
        applicationsList: state.applicationsList.map((a) =>
          a.id === action.payload.application.id ? action.payload.application : a
        ),
      }

    case types.FETCH_APPLICATIONS_FAILURE:
    case types.CREATE_APPLICATION_FAILURE:
      return { ...state, loading: false, error: action.payload.error }

    default:
      return state
  }
}
