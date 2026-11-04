import {
  CaseProject,
  ProjectComment,
  ProjectEvaluation,
  ProjectMilestone,
  ProjectSubmission,
} from '../../types/models'
import * as types from '../types'

export interface CasesState {
  casesList: CaseProject[]
  activeCase: CaseProject | null
  milestones: ProjectMilestone[]
  submission: ProjectSubmission | null
  evaluation: ProjectEvaluation | null
  comments: ProjectComment[]
  favorites: string[]
  ndaAcceptedCases: string[]
  filters: {
    search: string
    direction: string
    complexity: string
    participationFormat: string
    workFormat: string
    rewardType: string
    status: string
    companyId?: string
    hasReward: boolean
  }
  loading: boolean
  error: string | null
}

const initialFilters = {
  search: '',
  direction: 'all',
  complexity: 'all',
  participationFormat: 'all',
  workFormat: 'all',
  rewardType: 'all',
  status: 'all',
  hasReward: false,
}

const initialState: CasesState = {
  casesList: [],
  activeCase: null,
  milestones: [],
  submission: null,
  evaluation: null,
  comments: [],
  favorites: [],
  ndaAcceptedCases: [],
  filters: initialFilters,
  loading: false,
  error: null,
}

export const casesReducer = (state = initialState, action: any): CasesState => {
  switch (action.type) {
    case types.FETCH_CASE_BY_ID_REQUEST:
      if (state.activeCase?.id === action.payload.id) return { ...state, loading: true, error: null }
      return { ...state, loading: true, error: null, activeCase: null, milestones: [], submission: null, evaluation: null, comments: [] }

    case types.FETCH_CASES_REQUEST:
    case types.CREATE_CASE_REQUEST:
    case types.UPDATE_CASE_REQUEST:
      return { ...state, loading: true, error: null }

    case types.FETCH_CASES_SUCCESS:
      return { ...state, loading: false, casesList: action.payload.cases }

    case types.FETCH_CASE_BY_ID_SUCCESS:
      return { ...state, loading: false, activeCase: action.payload.caseItem }

    case types.CREATE_CASE_SUCCESS:
      return {
        ...state,
        loading: false,
        casesList: [action.payload.caseItem, ...state.casesList],
      }

    case types.UPDATE_CASE_SUCCESS:
      return {
        ...state,
        loading: false,
        casesList: state.casesList.map((c) => (c.id === action.payload.caseItem.id ? action.payload.caseItem : c)),
        activeCase: state.activeCase?.id === action.payload.caseItem.id ? action.payload.caseItem : state.activeCase,
      }

    case types.DELETE_CASE_SUCCESS:
      return {
        ...state,
        casesList: state.casesList.filter((c) => c.id !== action.payload.id),
      }

    case types.FETCH_FAVORITES_SUCCESS:
    case types.TOGGLE_FAVORITE_SUCCESS:
      return { ...state, favorites: action.payload.favorites }

    case types.ACCEPT_NDA_SUCCESS:
      return {
        ...state,
        ndaAcceptedCases: [...state.ndaAcceptedCases, action.payload.caseId],
      }

    case types.SET_CASE_FILTERS:
      return {
        ...state,
        filters: { ...state.filters, ...action.payload.filters },
      }

    case types.RESET_CASE_FILTERS:
      return {
        ...state,
        filters: initialFilters,
      }

    // Milestones
    case types.FETCH_MILESTONES_SUCCESS:
      return { ...state, milestones: action.payload.milestones }

    case types.SUBMIT_MILESTONE_SUCCESS:
    case types.UPDATE_MILESTONE_STATUS_SUCCESS:
      return {
        ...state,
        milestones: state.milestones.map((m) => (m.id === action.payload.milestone.id ? action.payload.milestone : m)),
      }

    // Submissions & Evaluations
    case types.FETCH_SUBMISSION_SUCCESS:
      return { ...state, submission: action.payload.submission || null }

    case types.CREATE_SUBMISSION_SUCCESS:
      return { ...state, submission: action.payload.submission }

    case types.FETCH_EVALUATION_SUCCESS:
      return { ...state, evaluation: action.payload.evaluation || null }

    case types.CREATE_EVALUATION_SUCCESS:
      return { ...state, evaluation: action.payload.evaluation }

    // Comments
    case types.FETCH_COMMENTS_SUCCESS:
      return { ...state, comments: action.payload.comments }

    case types.ADD_COMMENT_SUCCESS:
      return { ...state, comments: [...state.comments, action.payload.comment] }

    case types.FETCH_CASES_FAILURE:
    case types.FETCH_CASE_BY_ID_FAILURE:
    case types.CREATE_CASE_FAILURE:
    case types.UPDATE_CASE_FAILURE:
      return { ...state, loading: false, error: action.payload.error }

    default:
      return state
  }
}
