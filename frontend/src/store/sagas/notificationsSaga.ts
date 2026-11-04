import { all, call, put, takeLatest } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { AuditLog, SystemNotification } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchNotifications(action: { type: string; payload: { userId: string } }) {
  try {
    const notifications: SystemNotification[] = yield call(apiClient.getNotifications, action.payload.userId)
    yield put(actions.fetchNotificationsSuccess(notifications))
  } catch (e) {
    console.error(e)
  }
}

function* handleMarkNotificationRead(action: { type: string; payload: { id: string } }) {
  try {
    yield call(apiClient.markNotificationRead, action.payload.id)
    yield put(actions.markNotificationReadSuccess(action.payload.id))
  } catch (e) {
    console.error(e)
  }
}

function* handleMarkAllNotificationsRead(action: { type: string; payload: { userId: string } }) {
  try {
    yield call(apiClient.markAllNotificationsRead, action.payload.userId)
    yield put(actions.markAllNotificationsReadSuccess())
  } catch (e) {
    console.error(e)
  }
}

function* handleFetchAuditLogs() {
  try {
    const logs: AuditLog[] = yield call(apiClient.getAuditLogs)
    yield put(actions.fetchAuditLogsSuccess(logs))
  } catch (e) {
    console.error(e)
  }
}

export function* notificationsSaga() {
  yield all([
    takeLatest(types.FETCH_NOTIFICATIONS_REQUEST, handleFetchNotifications),
    takeLatest(types.MARK_NOTIFICATION_READ_REQUEST, handleMarkNotificationRead),
    takeLatest(types.MARK_ALL_NOTIFICATIONS_READ_REQUEST, handleMarkAllNotificationsRead),
    takeLatest(types.FETCH_AUDIT_LOGS_REQUEST, handleFetchAuditLogs),
  ])
}
