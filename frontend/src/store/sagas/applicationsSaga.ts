import { all, call, put, takeLatest } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { CaseApplication } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchApplications(action: { type: string; payload: { caseId?: string; studentId?: string } }) {
  try {
    const apps: CaseApplication[] = yield call(apiClient.getApplications, action.payload.caseId, action.payload.studentId)
    yield put(actions.fetchApplicationsSuccess(apps))
  } catch (error: any) {
    yield put(actions.fetchApplicationsFailure(error.message || 'Ошибка загрузки заявок'))
  }
}

function* handleCreateApplication(action: { type: string; payload: { data: any } }) {
  try {
    const app: CaseApplication = yield call(apiClient.createApplication, action.payload.data)
    yield put(actions.createApplicationSuccess(app))
    yield put(actions.fetchCaseByIdRequest(action.payload.data.caseId))
  } catch (error: any) {
    yield put(actions.createApplicationFailure(error.message || 'Не удалось отправить заявку'))
  }
}

function* handleUpdateApplicationStatus(action: {
  type: string
  payload: { appId: string; status: any; notes?: string }
}) {
  try {
    const app: CaseApplication = yield call(
      apiClient.updateApplicationStatus,
      action.payload.appId,
      action.payload.status,
      action.payload.notes
    )
    yield put(actions.updateApplicationStatusSuccess(app))
    yield put(actions.fetchCaseByIdRequest(app.caseId))
  } catch (e) {
    console.error(e)
  }
}

export function* applicationsSaga() {
  yield all([
    takeLatest(types.FETCH_APPLICATIONS_REQUEST, handleFetchApplications),
    takeLatest(types.CREATE_APPLICATION_REQUEST, handleCreateApplication),
    takeLatest(types.UPDATE_APPLICATION_STATUS_REQUEST, handleUpdateApplicationStatus),
  ])
}
