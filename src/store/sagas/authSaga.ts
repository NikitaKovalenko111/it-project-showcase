import { all, call, put, takeLatest } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { User } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleLogin(action: { type: string; payload: { username: string; password?: string } }) {
  try {
    const user: User = yield call(apiClient.login, action.payload.username, action.payload.password)
    yield put(actions.loginSuccess(user))
    yield put(actions.fetchNotificationsRequest(user.id))
  } catch (error: any) {
    const messages: Record<string, string> = {
      role_approval_pending: 'Заявка на роль ещё на рассмотрении.',
      role_request_rejected: 'Администратор отклонил заявку на роль.',
    }
    yield put(actions.loginFailure(messages[error.code] || error.message || 'Ошибка входа'))
  }
}

function* handleRegister(action: { type: string; payload: any }) {
  try {
    const user: User = yield call(apiClient.register, action.payload)
    yield put(actions.registerSuccess(user))
    yield put(actions.fetchNotificationsRequest(user.id))
  } catch (error: any) {
    yield put(actions.registerFailure(error.message || 'Ошибка регистрации'))
  }
}

function* handleLogout() {
  try {
    yield call(apiClient.logout)
    yield put(actions.logoutSuccess())
  } catch (e) {
    yield put(actions.logoutSuccess())
  }
}

function* handleFetchCurrentUser() {
  try {
    const user: User = yield call(apiClient.getCurrentUser)
    yield put(actions.fetchCurrentUserSuccess(user))
    yield put(actions.fetchNotificationsRequest(user.id))
  } catch (error: any) {
    yield put(
      actions.fetchCurrentUserFailure(error.message || 'Не удалось получить текущего пользователя'),
    )
  }
}

function* handleSwitchUser(action: { type: string; payload: { user: User } }) {
  try {
    localStorage.setItem('uust_current_user', JSON.stringify(action.payload.user))
    yield put(actions.switchUserSuccess(action.payload.user))
    yield put(actions.fetchNotificationsRequest(action.payload.user.id))
  } catch (e) {
    console.error(e)
  }
}

function* handleUpdateUserProfile(action: { type: string; payload: { user: User } }) {
  try {
    const updated: User = yield call(apiClient.updateUser, action.payload.user)
    yield put(actions.updateUserProfileSuccess(updated))
  } catch (error: any) {
    yield put({
      type: types.UPDATE_USER_PROFILE_FAILURE,
      payload: { error: error.message || 'Не удалось обновить профиль' },
    })
  }
}

function* handleFetchAllUsers() {
  try {
    const users: User[] = yield call(apiClient.getUsers)
    yield put(actions.fetchAllUsersSuccess(users))
  } catch (error: any) {
    yield put({ type: types.FETCH_ALL_USERS_FAILURE, payload: { error: error.message } })
  }
}

function* handleToggleUserBlock(action: {
  type: string
  payload: { user: User; blocked: boolean; reason: string }
}) {
  try {
    const user: User = yield call(
      apiClient.setUserBlock,
      action.payload.user,
      action.payload.blocked,
      action.payload.reason,
    )
    yield put(actions.toggleUserBlockSuccess(user))
    yield put(actions.fetchAuditLogsRequest())
  } catch (e) {
    console.error(e)
  }
}

function* handleChangeUserRole(action: {
  type: string
  payload: { userId: string; role: User['role'] }
}) {
  try {
    const user: User = yield call(
      apiClient.changeUserRole,
      action.payload.userId,
      action.payload.role,
    )
    yield put(actions.changeUserRoleSuccess(user))
  } catch (e) {
    console.error(e)
  }
}

export function* authSaga() {
  yield all([
    takeLatest(types.LOGIN_REQUEST, handleLogin),
    takeLatest(types.REGISTER_REQUEST, handleRegister),
    takeLatest(types.LOGOUT_REQUEST, handleLogout),
    takeLatest(types.FETCH_CURRENT_USER_REQUEST, handleFetchCurrentUser),
    takeLatest(types.SWITCH_USER_REQUEST, handleSwitchUser),
    takeLatest(types.UPDATE_USER_PROFILE_REQUEST, handleUpdateUserProfile),
    takeLatest(types.FETCH_ALL_USERS_REQUEST, handleFetchAllUsers),
    takeLatest(types.TOGGLE_USER_BLOCK_REQUEST, handleToggleUserBlock),
    takeLatest(types.CHANGE_USER_ROLE_REQUEST, handleChangeUserRole),
  ])
}
