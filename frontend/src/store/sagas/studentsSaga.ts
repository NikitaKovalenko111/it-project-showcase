import { all, call, put, takeLatest } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import { ProjectTeam, User } from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchStudents(action: { type: string; payload: { filters?: any } }) {
  try {
    const students: User[] = yield call(apiClient.getStudents, action.payload.filters)
    yield put(actions.fetchStudentsSuccess(students))
  } catch (error: any) {
    yield put(actions.fetchStudentsFailure(error.message || 'Ошибка загрузки студентов'))
  }
}

function* handleInviteStudent(action: {
  type: string
  payload: { studentId: string; caseId: string; inviteType: string; message: string }
}) {
  try {
    yield call(
      apiClient.inviteStudent,
      action.payload.studentId,
      action.payload.caseId,
      action.payload.inviteType,
      action.payload.message
    )
    yield put(actions.inviteStudentSuccess())
  } catch (e) {
    console.error(e)
  }
}

function* handleFetchTeams() {
  try {
    const teams: ProjectTeam[] = yield call(apiClient.getTeams)
    yield put(actions.fetchTeamsSuccess(teams))
  } catch (e) {
    console.error(e)
  }
}

function* handleCreateTeam(action: { type: string; payload: { data: any } }) {
  try {
    const team: ProjectTeam = yield call(apiClient.createTeam, action.payload.data)
    yield put(actions.createTeamSuccess(team))
  } catch (e) {
    console.error(e)
  }
}

export function* studentsSaga() {
  yield all([
    takeLatest(types.FETCH_STUDENTS_REQUEST, handleFetchStudents),
    takeLatest(types.INVITE_STUDENT_REQUEST, handleInviteStudent),
    takeLatest(types.FETCH_TEAMS_REQUEST, handleFetchTeams),
    takeLatest(types.CREATE_TEAM_REQUEST, handleCreateTeam),
  ])
}
