import { StudentProject } from '../../types/models'
import * as types from '../types'

export interface StudentProjectsState {
  pendingLikes: string[]
  projectsList: StudentProject[]
  activeProject: StudentProject | null
  filters: {
    search: string
    category: string
    direction: string
    badge: string
  }
  loading: boolean
  error: string | null
}

const initialFilters = {
  search: '',
  category: 'all',
  direction: 'all',
  badge: 'all',
}

const initialState: StudentProjectsState = {
  pendingLikes: [],
  projectsList: [],
  activeProject: null,
  filters: initialFilters,
  loading: false,
  error: null,
}

export const studentProjectsReducer = (state = initialState, action: any): StudentProjectsState => {
  switch (action.type) {
    case types.FETCH_STUDENT_PROJECTS_REQUEST:
    case types.FETCH_STUDENT_PROJECT_BY_ID_REQUEST:
    case types.CREATE_STUDENT_PROJECT_REQUEST:
      return { ...state, loading: true, error: null }

    case types.FETCH_STUDENT_PROJECTS_SUCCESS:
      return { ...state, loading: false, projectsList: action.payload.projects }

    case types.FETCH_STUDENT_PROJECT_BY_ID_SUCCESS:
      return { ...state, loading: false, activeProject: action.payload.project }

    case types.CREATE_STUDENT_PROJECT_SUCCESS:
      return {
        ...state,
        loading: false,
        projectsList: [action.payload.project, ...state.projectsList],
      }

    case types.LIKE_STUDENT_PROJECT_REQUEST:
      return {
        ...state,
        error: null,
        pendingLikes: [...new Set([...state.pendingLikes, action.payload.id])],
      }
    case types.LIKE_STUDENT_PROJECT_FAILURE:
      return {
        ...state,
        pendingLikes: state.pendingLikes.filter((id) => id !== action.payload.id),
        error: action.payload.error,
      }
    case types.UPDATE_STUDENT_PROJECT_SUCCESS:
    case types.LIKE_STUDENT_PROJECT_SUCCESS:
      return {
        ...state,
        pendingLikes: state.pendingLikes.filter((id) => id !== action.payload.project.id),
        projectsList: state.projectsList.map((p) =>
          p.id === action.payload.project.id ? action.payload.project : p,
        ),
        activeProject:
          state.activeProject?.id === action.payload.project.id
            ? action.payload.project
            : state.activeProject,
      }

    case types.SET_STUDENT_PROJECT_FILTERS:
      return {
        ...state,
        filters: { ...state.filters, ...action.payload.filters },
      }

    case types.FETCH_STUDENT_PROJECTS_FAILURE:
      return { ...state, loading: false, error: action.payload.error }

    default:
      return state
  }
}
