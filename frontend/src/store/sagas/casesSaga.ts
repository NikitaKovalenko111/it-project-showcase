import { all, call, put, takeLatest } from 'redux-saga/effects'
import { apiClient } from '../../api/client'
import {
  CaseProject,
  ProjectComment,
  ProjectEvaluation,
  ProjectMilestone,
  ProjectSubmission,
} from '../../types/models'
import * as actions from '../actions'
import * as types from '../types'

function* handleFetchCases(action: { type: string; payload: { filters?: any } }) {
  try {
    const cases: CaseProject[] = yield call(apiClient.getCases, action.payload.filters)
    yield put(actions.fetchCasesSuccess(cases))
  } catch (error: any) {
    yield put(actions.fetchCasesFailure(error.message || 'Ошибка загрузки кейсов'))
  }
}

function* handleFetchCaseById(action: { type: string; payload: { id: string } }) {
  try {
    const caseItem: CaseProject = yield call(apiClient.getCaseById, action.payload.id)
    yield put(actions.fetchCaseByIdSuccess(caseItem))
  } catch (error: any) {
    yield put(actions.fetchCaseByIdFailure(error.message || 'Ошибка загрузки кейса'))
  }
}

function* handleCreateCase(action: { type: string; payload: { caseData: any } }) {
  try {
    const created: CaseProject = yield call(apiClient.createCase, action.payload.caseData)
    yield put(actions.createCaseSuccess(created))
  } catch (error: any) {
    yield put({ type: types.UPDATE_CASE_FAILURE, payload: { error: error.message || 'Не удалось сохранить кейс' } })
  }
}

function* handleUpdateCase(action: { type: string; payload: { caseData: CaseProject } }) {
  try {
    const updated: CaseProject = yield call(apiClient.updateCase, action.payload.caseData)
    yield put(actions.updateCaseSuccess(updated))
  } catch (error: any) {
    yield put({ type: types.UPDATE_CASE_FAILURE, payload: { error: error.message || 'Не удалось сохранить кейс' } })
  }
}

function* handleDeleteCase(action: { type: string; payload: { id: string } }) {
  try {
    yield call(apiClient.deleteCase, action.payload.id)
    yield put(actions.deleteCaseSuccess(action.payload.id))
  } catch (e) {
    console.error(e)
  }
}

function* handleFetchFavorites() {
  try {
    const favs: string[] = yield call(apiClient.getFavorites)
    yield put(actions.fetchFavoritesSuccess(favs))
  } catch (e) {
    console.error(e)
  }
}

function* handleToggleFavorite(action: { type: string; payload: { caseId: string } }) {
  try {
    const updatedFavs: string[] = yield call(apiClient.toggleFavorite, action.payload.caseId)
    yield put(actions.toggleFavoriteSuccess(updatedFavs))
  } catch (e) {
    console.error(e)
  }
}

function* handleAcceptNDA(action: { type: string; payload: { caseId: string; userId: string } }) {
  try {
    yield call(apiClient.acceptNDA, action.payload.caseId, action.payload.userId)
    yield put(actions.acceptNDASuccess(action.payload.caseId))
  } catch (e) {
    console.error(e)
  }
}

// Milestones
function* handleFetchMilestones(action: { type: string; payload: { caseId: string } }) {
  try {
    const milestones: ProjectMilestone[] = yield call(apiClient.getMilestones, action.payload.caseId)
    yield put(actions.fetchMilestonesSuccess(milestones))
  } catch (e) {
    console.error(e)
  }
}

function* handleSubmitMilestone(action: { type: string; payload: { milestoneId: string; materials: any[] } }) {
  try {
    const updated: ProjectMilestone = yield call(
      apiClient.submitMilestone,
      action.payload.milestoneId,
      action.payload.materials
    )
    yield put(actions.submitMilestoneSuccess(updated))
  } catch (e) {
    console.error(e)
  }
}

function* handleUpdateMilestoneStatus(action: {
  type: string
  payload: { milestoneId: string; status: any; feedback?: string }
}) {
  try {
    const updated: ProjectMilestone = yield call(
      apiClient.updateMilestoneStatus,
      action.payload.milestoneId,
      action.payload.status,
      action.payload.feedback
    )
    yield put(actions.updateMilestoneStatusSuccess(updated))
  } catch (e) {
    console.error(e)
  }
}

// Submission & Evaluation
function* handleFetchSubmission(action: { type: string; payload: { caseId: string } }) {
  try {
    const sub: ProjectSubmission | undefined = yield call(apiClient.getSubmission, action.payload.caseId)
    yield put(actions.fetchSubmissionSuccess(sub))
  } catch (e) {
    console.error(e)
  }
}

function* handleCreateSubmission(action: { type: string; payload: { data: any } }) {
  try {
    const sub: ProjectSubmission = yield call(apiClient.createSubmission, action.payload.data)
    yield put(actions.createSubmissionSuccess(sub))
    yield put(actions.fetchCaseByIdRequest(action.payload.data.caseId))
  } catch (e) {
    console.error(e)
  }
}

function* handleFetchEvaluation(action: { type: string; payload: { caseId: string } }) {
  try {
    const evalData: ProjectEvaluation | undefined = yield call(apiClient.getEvaluation, action.payload.caseId)
    yield put(actions.fetchEvaluationSuccess(evalData))
  } catch (e) {
    console.error(e)
  }
}

function* handleCreateEvaluation(action: { type: string; payload: { data: any } }) {
  try {
    const evalData: ProjectEvaluation = yield call(apiClient.createEvaluation, action.payload.data)
    yield put(actions.createEvaluationSuccess(evalData))
    yield put(actions.fetchCaseByIdRequest(action.payload.data.caseId))
  } catch (e) {
    console.error(e)
  }
}

// Comments
function* handleFetchComments(action: { type: string; payload: { caseId: string } }) {
  try {
    const comments: ProjectComment[] = yield call(apiClient.getComments, action.payload.caseId)
    yield put(actions.fetchCommentsSuccess(comments))
  } catch (e) {
    console.error(e)
  }
}

function* handleAddComment(action: { type: string; payload: { data: any } }) {
  try {
    const comment: ProjectComment = yield call(apiClient.addComment, action.payload.data)
    yield put(actions.addCommentSuccess(comment))
  } catch (e) {
    console.error(e)
  }
}

export function* casesSaga() {
  yield all([
    takeLatest(types.FETCH_CASES_REQUEST, handleFetchCases),
    takeLatest(types.FETCH_CASE_BY_ID_REQUEST, handleFetchCaseById),
    takeLatest(types.CREATE_CASE_REQUEST, handleCreateCase),
    takeLatest(types.UPDATE_CASE_REQUEST, handleUpdateCase),
    takeLatest(types.DELETE_CASE_REQUEST, handleDeleteCase),
    takeLatest(types.FETCH_FAVORITES_REQUEST, handleFetchFavorites),
    takeLatest(types.TOGGLE_FAVORITE_REQUEST, handleToggleFavorite),
    takeLatest(types.ACCEPT_NDA_REQUEST, handleAcceptNDA),
    takeLatest(types.FETCH_MILESTONES_REQUEST, handleFetchMilestones),
    takeLatest(types.SUBMIT_MILESTONE_REQUEST, handleSubmitMilestone),
    takeLatest(types.UPDATE_MILESTONE_STATUS_REQUEST, handleUpdateMilestoneStatus),
    takeLatest(types.FETCH_SUBMISSION_REQUEST, handleFetchSubmission),
    takeLatest(types.CREATE_SUBMISSION_REQUEST, handleCreateSubmission),
    takeLatest(types.FETCH_EVALUATION_REQUEST, handleFetchEvaluation),
    takeLatest(types.CREATE_EVALUATION_REQUEST, handleCreateEvaluation),
    takeLatest(types.FETCH_COMMENTS_REQUEST, handleFetchComments),
    takeLatest(types.ADD_COMMENT_REQUEST, handleAddComment),
  ])
}
