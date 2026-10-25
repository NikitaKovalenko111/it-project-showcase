import { Company } from '../../types/models'
import * as types from '../types'

export interface CompaniesState {
  companiesList: Company[]
  activeCompany: Company | null
  loading: boolean
  error: string | null
}

const initialState: CompaniesState = {
  companiesList: [],
  activeCompany: null,
  loading: false,
  error: null,
}

export const companiesReducer = (state = initialState, action: any): CompaniesState => {
  switch (action.type) {
    case types.FETCH_COMPANIES_REQUEST:
    case types.FETCH_COMPANY_BY_ID_REQUEST:
    case types.VERIFY_COMPANY_REQUEST:
      return { ...state, loading: true, error: null }

    case types.FETCH_COMPANIES_SUCCESS:
      return { ...state, loading: false, companiesList: action.payload.companies }

    case types.FETCH_COMPANY_BY_ID_SUCCESS:
      return { ...state, loading: false, activeCompany: action.payload.company }

    case types.VERIFY_COMPANY_SUCCESS:
      return {
        ...state,
        loading: false,
        companiesList: state.companiesList.map((c) => (c.id === action.payload.company.id ? action.payload.company : c)),
        activeCompany:
          state.activeCompany?.id === action.payload.company.id ? action.payload.company : state.activeCompany,
      }

    case types.FETCH_COMPANIES_FAILURE:
      return { ...state, loading: false, error: action.payload.error }

    default:
      return state
  }
}
