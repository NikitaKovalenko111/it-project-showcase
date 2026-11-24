import { all, call, put, takeLatest, takeEvery, select } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { StudentProject } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchStudentProjects(action: { type: string; payload: { filters?: any } }) {
  try {
    const projects: StudentProject[] = yield call(
      apiClient.getStudentProjects,
      action.payload.filters,
    )
    yield put(actions.fetchStudentProjectsSuccess(projects))
  } catch (error: any) {
    yield put(actions.fetchStudentProjectsFailure(error.message || 'Ошибка загрузки проектов'))
  }
}

function* handleFetchStudentProjectById(action: { type: string; payload: { id: string } }) {
  try {
    const project: StudentProject = yield call(apiClient.getStudentProjectById, action.payload.id)
    yield put(actions.fetchStudentProjectByIdSuccess(project))
  } catch (error: any) {
    yield put(
      actions.fetchStudentProjectsFailure(error.message || 'Операция с проектом не выполнена'),
    )
  }
}

function* handleCreateStudentProject(action: { type: string; payload: { data: any } }) {
  try {
    const project: StudentProject = yield call(apiClient.createStudentProject, action.payload.data)
    yield put(actions.createStudentProjectSuccess(project))
  } catch (error: any) {
    yield put(
      actions.fetchStudentProjectsFailure(error.message || 'Операция с проектом не выполнена'),
    )
  }
}

const likesInFlight = new Set<string>()
function* handleLikeStudentProject(action: { type: string; payload: { id: string } }) {
  const actorId: string | undefined = yield select((state) => state.auth.currentUser?.id)
  if (!actorId) {
    yield put({
      type: types.LIKE_STUDENT_PROJECT_FAILURE,
      payload: { id: action.payload.id, error: 'Войдите в систему' },
    })
    return
  }
  const key = `${actorId}:${action.payload.id}`
  if (likesInFlight.has(key)) return
  likesInFlight.add(key)
  try {
    const project: StudentProject = yield call(
      apiClient.toggleStudentProjectLike,
      action.payload.id,
    )
    const currentId: string | undefined = yield select((state) => state.auth.currentUser?.id)
    if (currentId === actorId) yield put(actions.likeStudentProjectSuccess(project))
  } catch (error: any) {
    const currentId: string | undefined = yield select((state) => state.auth.currentUser?.id)
    if (currentId === actorId)
      yield put({
        type: types.LIKE_STUDENT_PROJECT_FAILURE,
        payload: { id: action.payload.id, error: error.message || 'Не удалось изменить лайк' },
      })
  } finally {
    likesInFlight.delete(key)
  }
}

export function* studentProjectsSaga() {
  yield all([
    takeLatest(types.FETCH_STUDENT_PROJECTS_REQUEST, handleFetchStudentProjects),
    takeLatest(types.FETCH_STUDENT_PROJECT_BY_ID_REQUEST, handleFetchStudentProjectById),
    takeLatest(types.CREATE_STUDENT_PROJECT_REQUEST, handleCreateStudentProject),
    takeEvery(types.LIKE_STUDENT_PROJECT_REQUEST, handleLikeStudentProject),
  ])
}
