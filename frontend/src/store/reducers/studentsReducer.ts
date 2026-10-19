import { ProjectTeam, User } from '../../types/models'
import * as types from '../types'

export interface StudentsState {
  studentsList: User[]
  teamsList: ProjectTeam[]
  filters: {
    search: string
    institute: string
    course: string
    skill: string
    minRating: number
  }
  loading: boolean
  error: string | null
}

const initialFilters = {
  search: '',
  institute: 'all',
  course: 'all',
  skill: '',
  minRating: 0,
}

const initialState: StudentsState = {
  studentsList: [],
  teamsList: [],
  filters: initialFilters,
  loading: false,
  error: null,
}

export const studentsReducer = (state = initialState, action: any): StudentsState => {
  switch (action.type) {
    case types.FETCH_STUDENTS_REQUEST:
    case types.FETCH_TEAMS_REQUEST:
    case types.CREATE_TEAM_REQUEST:
    case types.INVITE_STUDENT_REQUEST:
      return { ...state, loading: true, error: null }

    case types.FETCH_STUDENTS_SUCCESS:
      return { ...state, loading: false, studentsList: action.payload.students }

    case types.FETCH_TEAMS_SUCCESS:
      return { ...state, loading: false, teamsList: action.payload.teams }

    case types.CREATE_TEAM_SUCCESS:
      return {
        ...state,
        loading: false,
        teamsList: [...state.teamsList, action.payload.team],
      }

    case types.INVITE_STUDENT_SUCCESS:
      return { ...state, loading: false }

    case types.FETCH_STUDENTS_FAILURE:
      return { ...state, loading: false, error: action.payload.error }

    default:
      return state
  }
}
