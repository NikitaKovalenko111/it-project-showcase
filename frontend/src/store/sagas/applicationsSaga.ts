import { all, call, put, takeLatest, takeEvery } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { ApplicationStatusConflict } from '../../api/applicationStatus'
import { CaseApplication } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchApplications(action: {
  type: string
  payload: { caseId?: string; studentId?: string }
}) {
  try {
    const apps: CaseApplication[] = yield call(
      apiClient.getApplications,
      action.payload.caseId,
      action.payload.studentId,
    )
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

function* handleUpdateApplicationStatus(
  pending: Set<string>,
  { payload: { appId, status, notes } }: ReturnType<typeof actions.updateApplicationStatusRequest>,
) {
  if (pending.has(appId)) return
  pending.add(appId)
  try {
    const app: CaseApplication = yield call(apiClient.updateApplicationStatus, appId, status, notes)
    yield put(actions.updateApplicationStatusSuccess(app))
    if (app.status === 'accepted') {
      yield put(actions.fetchCasesRequest())
    }
    if (app.ndaAccessPending) {
      yield put(
        actions.fetchApplicationsFailure(
          'Заявка принята. Повторите выдачу доступа к ТЗ в карточке кейса.',
        ),
      )
    }
  } catch (error: any) {
    if (error instanceof ApplicationStatusConflict) {
      yield put(actions.updateApplicationStatusSuccess(error.application))
    }
    yield put(
      actions.fetchApplicationsFailure(error.message || 'Не удалось изменить статус заявки'),
    )
  } finally {
    pending.delete(appId)
  }
}

export function* applicationsSaga() {
  yield all([
    takeLatest(types.FETCH_APPLICATIONS_REQUEST, handleFetchApplications),
    takeLatest(types.CREATE_APPLICATION_REQUEST, handleCreateApplication),
    takeEvery(
      types.UPDATE_APPLICATION_STATUS_REQUEST,
      handleUpdateApplicationStatus,
      new Set<string>(),
    ),
  ])
}
