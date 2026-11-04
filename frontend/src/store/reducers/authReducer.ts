import { User } from '../../types/models'
import * as types from '../types'

export interface AuthState {
  currentUser: User | null
  allUsers: User[]
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  currentUser: null,
  allUsers: [],
  isAuthenticated: false,
  loading: false,
  error: null,
}

export const authReducer = (state = initialState, action: any): AuthState => {
  switch (action.type) {
    case types.LOGIN_REQUEST:
    case types.REGISTER_REQUEST:
    case types.FETCH_CURRENT_USER_REQUEST:
    case types.UPDATE_USER_PROFILE_REQUEST:
    case types.FETCH_ALL_USERS_REQUEST:
      return { ...state, loading: true, error: null }

    case types.LOGIN_SUCCESS:
    case types.REGISTER_SUCCESS:
    case types.FETCH_CURRENT_USER_SUCCESS:
    case types.SWITCH_USER_SUCCESS:
      return {
        ...state,
        loading: false,
        currentUser: action.payload.user,
        isAuthenticated: true,
        error: null,
      }

    case types.UPDATE_USER_PROFILE_SUCCESS:
      return {
        ...state,
        loading: false,
        currentUser: action.payload.user,
        allUsers: state.allUsers.map((u) => (u.id === action.payload.user.id ? action.payload.user : u)),
      }

    case types.FETCH_ALL_USERS_SUCCESS:
      return {
        ...state,
        loading: false,
        allUsers: action.payload.users,
      }

    case types.TOGGLE_USER_BLOCK_SUCCESS:
    case types.CHANGE_USER_ROLE_SUCCESS:
      return {
        ...state,
        allUsers: state.allUsers.map((u) => (u.id === action.payload.user.id ? action.payload.user : u)),
        currentUser: state.currentUser?.id === action.payload.user.id ? action.payload.user : state.currentUser,
      }

    case types.LOGIN_FAILURE:
    case types.REGISTER_FAILURE:
    case types.FETCH_CURRENT_USER_FAILURE:
    case types.UPDATE_USER_PROFILE_FAILURE:
    case types.FETCH_ALL_USERS_FAILURE:
      return { ...state, loading: false, error: action.payload.error }

    case types.LOGOUT_SUCCESS:
      return {
        ...state,
        currentUser: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      }

    default:
      return state
  }
}
