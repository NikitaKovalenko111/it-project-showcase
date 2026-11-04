import { all, call, put, takeLatest } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { Company } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchCompanies() {
  try {
    const companies: Company[] = yield call(apiClient.getCompanies)
    yield put(actions.fetchCompaniesSuccess(companies))
  } catch (error: any) {
    yield put(actions.fetchCompaniesFailure(error.message || 'Ошибка загрузки компаний'))
  }
}

function* handleFetchCompanyById(action: { type: string; payload: { id: string } }) {
  try {
    const company: Company = yield call(apiClient.getCompanyById, action.payload.id)
    yield put(actions.fetchCompanyByIdSuccess(company))
  } catch (error: any) {
    console.error(error)
  }
}

function* handleVerifyCompany(action: { type: string; payload: { id: string; status: boolean } }) {
  try {
    const company: Company = yield call(apiClient.verifyCompany, action.payload.id, action.payload.status)
    yield put(actions.verifyCompanySuccess(company))
  } catch (e) {
    console.error(e)
  }
}

export function* companiesSaga() {
  yield all([
    takeLatest(types.FETCH_COMPANIES_REQUEST, handleFetchCompanies),
    takeLatest(types.FETCH_COMPANY_BY_ID_REQUEST, handleFetchCompanyById),
    takeLatest(types.VERIFY_COMPANY_REQUEST, handleVerifyCompany),
  ])
}
