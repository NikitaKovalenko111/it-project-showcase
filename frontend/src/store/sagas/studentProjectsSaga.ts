import { all, call, put, takeLatest } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { StudentProject } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchStudentProjects(action: { type: string; payload: { filters?: any } }) {
  try {
    const projects: StudentProject[] = yield call(apiClient.getStudentProjects, action.payload.filters)
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
    console.error(error)
  }
}

function* handleCreateStudentProject(action: { type: string; payload: { data: any } }) {
  try {
    const project: StudentProject = yield call(apiClient.createStudentProject, action.payload.data)
    yield put(actions.createStudentProjectSuccess(project))
  } catch (error: any) {
    console.error(error)
  }
}

function* handleLikeStudentProject(action: { type: string; payload: { id: string } }) {
  try {
    const project: StudentProject = yield call(apiClient.toggleStudentProjectLike, action.payload.id)
    yield put(actions.likeStudentProjectSuccess(project))
  } catch (error: any) {
    console.error(error)
  }
}

export function* studentProjectsSaga() {
  yield all([
    takeLatest(types.FETCH_STUDENT_PROJECTS_REQUEST, handleFetchStudentProjects),
    takeLatest(types.FETCH_STUDENT_PROJECT_BY_ID_REQUEST, handleFetchStudentProjectById),
    takeLatest(types.CREATE_STUDENT_PROJECT_REQUEST, handleCreateStudentProject),
    takeLatest(types.LIKE_STUDENT_PROJECT_REQUEST, handleLikeStudentProject),
  ])
}
