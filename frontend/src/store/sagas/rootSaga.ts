import { all, cancel, fork, take } from 'redux-saga/effects'
import { authSaga } from './authSaga'
import { casesSaga } from './casesSaga'
import { studentProjectsSaga } from './studentProjectsSaga'
import { companiesSaga } from './companiesSaga'
import { applicationsSaga } from './applicationsSaga'
import { studentsSaga } from './studentsSaga'
import { notificationsSaga } from './notificationsSaga'

function* dataSagas() {
  yield all([
    fork(casesSaga),
    fork(studentProjectsSaga),
    fork(companiesSaga),
    fork(applicationsSaga),
    fork(studentsSaga),
    fork(notificationsSaga),
  ])
}

export function* rootSaga() {
  yield fork(authSaga)
  let task = yield fork(dataSagas)
  while (true) {
    yield take(['auth/SWITCH_USER_SUCCESS', 'auth/LOGOUT_SUCCESS', 'auth/LOGIN_SUCCESS'])
    yield cancel(task)
    task = yield fork(dataSagas)
  }
}
