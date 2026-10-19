import * as types from '../types'
import {
  CaseApplication,
  CaseProject,
  Company,
  ProjectComment,
  ProjectEvaluation,
  ProjectMilestone,
  ProjectSubmission,
  ProjectTeam,
  StudentProject,
  SystemNotification,
  User,
} from '../../types/models'

// Auth Actions
export const loginRequest = (username: string) => ({
  type: types.LOGIN_REQUEST,
  payload: { username },
})

export const loginSuccess = (user: User) => ({
  type: types.LOGIN_SUCCESS,
  payload: { user },
})

export const loginFailure = (error: string) => ({
  type: types.LOGIN_FAILURE,
  payload: { error },
})

export const registerRequest = (data: any) => ({
  type: types.REGISTER_REQUEST,
  payload: data,
})

export const registerSuccess = (user: User) => ({
  type: types.REGISTER_SUCCESS,
  payload: { user },
})

export const registerFailure = (error: string) => ({
  type: types.REGISTER_FAILURE,
  payload: { error },
})

export const logoutRequest = () => ({
  type: types.LOGOUT_REQUEST,
})

export const logoutSuccess = () => ({
  type: types.LOGOUT_SUCCESS,
})

export const fetchCurrentUserRequest = () => ({
  type: types.FETCH_CURRENT_USER_REQUEST,
})

export const fetchCurrentUserSuccess = (user: User) => ({
  type: types.FETCH_CURRENT_USER_SUCCESS,
  payload: { user },
})

export const fetchCurrentUserFailure = (error: string) => ({
  type: types.FETCH_CURRENT_USER_FAILURE,
  payload: { error },
})

export const switchUserRequest = (user: User) => ({
  type: types.SWITCH_USER_REQUEST,
  payload: { user },
})

export const switchUserSuccess = (user: User) => ({
  type: types.SWITCH_USER_SUCCESS,
  payload: { user },
})

export const updateUserProfileRequest = (user: User) => ({
  type: types.UPDATE_USER_PROFILE_REQUEST,
  payload: { user },
})

export const updateUserProfileSuccess = (user: User) => ({
  type: types.UPDATE_USER_PROFILE_SUCCESS,
  payload: { user },
})

export const fetchAllUsersRequest = () => ({
  type: types.FETCH_ALL_USERS_REQUEST,
})

export const fetchAllUsersSuccess = (users: User[]) => ({
  type: types.FETCH_ALL_USERS_SUCCESS,
  payload: { users },
})

export const toggleUserBlockRequest = (userId: string) => ({
  type: types.TOGGLE_USER_BLOCK_REQUEST,
  payload: { userId },
})

export const toggleUserBlockSuccess = (user: User) => ({
  type: types.TOGGLE_USER_BLOCK_SUCCESS,
  payload: { user },
})

export const changeUserRoleRequest = (userId: string, role: User['role']) => ({
  type: types.CHANGE_USER_ROLE_REQUEST,
  payload: { userId, role },
})

export const changeUserRoleSuccess = (user: User) => ({
  type: types.CHANGE_USER_ROLE_SUCCESS,
  payload: { user },
})

// Cases Actions
export const fetchCasesRequest = (filters?: any) => ({
  type: types.FETCH_CASES_REQUEST,
  payload: { filters },
})

export const fetchCasesSuccess = (cases: CaseProject[]) => ({
  type: types.FETCH_CASES_SUCCESS,
  payload: { cases },
})

export const fetchCasesFailure = (error: string) => ({
  type: types.FETCH_CASES_FAILURE,
  payload: { error },
})

export const fetchCaseByIdRequest = (id: string) => ({
  type: types.FETCH_CASE_BY_ID_REQUEST,
  payload: { id },
})

export const fetchCaseByIdSuccess = (caseItem: CaseProject) => ({
  type: types.FETCH_CASE_BY_ID_SUCCESS,
  payload: { caseItem },
})

export const fetchCaseByIdFailure = (error: string) => ({
  type: types.FETCH_CASE_BY_ID_FAILURE,
  payload: { error },
})

export const createCaseRequest = (caseData: any) => ({
  type: types.CREATE_CASE_REQUEST,
  payload: { caseData },
})

export const createCaseSuccess = (caseItem: CaseProject) => ({
  type: types.CREATE_CASE_SUCCESS,
  payload: { caseItem },
})

export const updateCaseRequest = (caseData: CaseProject) => ({
  type: types.UPDATE_CASE_REQUEST,
  payload: { caseData },
})

export const updateCaseSuccess = (caseItem: CaseProject) => ({
  type: types.UPDATE_CASE_SUCCESS,
  payload: { caseItem },
})

export const deleteCaseRequest = (id: string) => ({
  type: types.DELETE_CASE_REQUEST,
  payload: { id },
})

export const deleteCaseSuccess = (id: string) => ({
  type: types.DELETE_CASE_SUCCESS,
  payload: { id },
})

export const toggleFavoriteRequest = (caseId: string) => ({
  type: types.TOGGLE_FAVORITE_REQUEST,
  payload: { caseId },
})

export const toggleFavoriteSuccess = (favorites: string[]) => ({
  type: types.TOGGLE_FAVORITE_SUCCESS,
  payload: { favorites },
})

export const fetchFavoritesRequest = () => ({
  type: types.FETCH_FAVORITES_REQUEST,
})

export const fetchFavoritesSuccess = (favorites: string[]) => ({
  type: types.FETCH_FAVORITES_SUCCESS,
  payload: { favorites },
})

export const setCaseFilters = (filters: any) => ({
  type: types.SET_CASE_FILTERS,
  payload: { filters },
})

export const resetCaseFilters = () => ({
  type: types.RESET_CASE_FILTERS,
})

export const acceptNDARequest = (caseId: string, userId: string) => ({
  type: types.ACCEPT_NDA_REQUEST,
  payload: { caseId, userId },
})

export const acceptNDASuccess = (caseId: string) => ({
  type: types.ACCEPT_NDA_SUCCESS,
  payload: { caseId },
})

// Milestones Actions
export const fetchMilestonesRequest = (caseId: string) => ({
  type: types.FETCH_MILESTONES_REQUEST,
  payload: { caseId },
})

export const fetchMilestonesSuccess = (milestones: ProjectMilestone[]) => ({
  type: types.FETCH_MILESTONES_SUCCESS,
  payload: { milestones },
})

export const submitMilestoneRequest = (milestoneId: string, materials: any[]) => ({
  type: types.SUBMIT_MILESTONE_REQUEST,
  payload: { milestoneId, materials },
})

export const submitMilestoneSuccess = (milestone: ProjectMilestone) => ({
  type: types.SUBMIT_MILESTONE_SUCCESS,
  payload: { milestone },
})

export const updateMilestoneStatusRequest = (milestoneId: string, status: any, feedback?: string) => ({
  type: types.UPDATE_MILESTONE_STATUS_REQUEST,
  payload: { milestoneId, status, feedback },
})

export const updateMilestoneStatusSuccess = (milestone: ProjectMilestone) => ({
  type: types.UPDATE_MILESTONE_STATUS_SUCCESS,
  payload: { milestone },
})

// Submissions & Evaluations Actions
export const fetchSubmissionRequest = (caseId: string) => ({
  type: types.FETCH_SUBMISSION_REQUEST,
  payload: { caseId },
})

export const fetchSubmissionSuccess = (submission?: ProjectSubmission) => ({
  type: types.FETCH_SUBMISSION_SUCCESS,
  payload: { submission },
})

export const createSubmissionRequest = (data: any) => ({
  type: types.CREATE_SUBMISSION_REQUEST,
  payload: { data },
})

export const createSubmissionSuccess = (submission: ProjectSubmission) => ({
  type: types.CREATE_SUBMISSION_SUCCESS,
  payload: { submission },
})

export const fetchEvaluationRequest = (caseId: string) => ({
  type: types.FETCH_EVALUATION_REQUEST,
  payload: { caseId },
})

export const fetchEvaluationSuccess = (evaluation?: ProjectEvaluation) => ({
  type: types.FETCH_EVALUATION_SUCCESS,
  payload: { evaluation },
})

export const createEvaluationRequest = (data: any) => ({
  type: types.CREATE_EVALUATION_REQUEST,
  payload: { data },
})

export const createEvaluationSuccess = (evaluation: ProjectEvaluation) => ({
  type: types.CREATE_EVALUATION_SUCCESS,
  payload: { evaluation },
})

// Comments
export const fetchCommentsRequest = (caseId: string) => ({
  type: types.FETCH_COMMENTS_REQUEST,
  payload: { caseId },
})

export const fetchCommentsSuccess = (comments: ProjectComment[]) => ({
  type: types.FETCH_COMMENTS_SUCCESS,
  payload: { comments },
})

export const addCommentRequest = (data: any) => ({
  type: types.ADD_COMMENT_REQUEST,
  payload: { data },
})

export const addCommentSuccess = (comment: ProjectComment) => ({
  type: types.ADD_COMMENT_SUCCESS,
  payload: { comment },
})

// Applications
export const fetchApplicationsRequest = (caseId?: string, studentId?: string) => ({
  type: types.FETCH_APPLICATIONS_REQUEST,
  payload: { caseId, studentId },
})

export const fetchApplicationsSuccess = (applications: CaseApplication[]) => ({
  type: types.FETCH_APPLICATIONS_SUCCESS,
  payload: { applications },
})

export const createApplicationRequest = (data: any) => ({
  type: types.CREATE_APPLICATION_REQUEST,
  payload: { data },
})

export const createApplicationSuccess = (application: CaseApplication) => ({
  type: types.CREATE_APPLICATION_SUCCESS,
  payload: { application },
})

export const updateApplicationStatusRequest = (appId: string, status: any, notes?: string) => ({
  type: types.UPDATE_APPLICATION_STATUS_REQUEST,
  payload: { appId, status, notes },
})

export const updateApplicationStatusSuccess = (application: CaseApplication) => ({
  type: types.UPDATE_APPLICATION_STATUS_SUCCESS,
  payload: { application },
})

export const fetchApplicationsFailure = (error: string) => ({
  type: types.FETCH_APPLICATIONS_FAILURE,
  payload: { error },
})

export const createApplicationFailure = (error: string) => ({
  type: types.CREATE_APPLICATION_FAILURE,
  payload: { error },
})

// Student Projects
export const fetchStudentProjectsRequest = (filters?: any) => ({
  type: types.FETCH_STUDENT_PROJECTS_REQUEST,
  payload: { filters },
})

export const fetchStudentProjectsSuccess = (projects: StudentProject[]) => ({
  type: types.FETCH_STUDENT_PROJECTS_SUCCESS,
  payload: { projects },
})

export const fetchStudentProjectByIdRequest = (id: string) => ({
  type: types.FETCH_STUDENT_PROJECT_BY_ID_REQUEST,
  payload: { id },
})

export const fetchStudentProjectByIdSuccess = (project: StudentProject) => ({
  type: types.FETCH_STUDENT_PROJECT_BY_ID_SUCCESS,
  payload: { project },
})

export const createStudentProjectRequest = (data: any) => ({
  type: types.CREATE_STUDENT_PROJECT_REQUEST,
  payload: { data },
})

export const createStudentProjectSuccess = (project: StudentProject) => ({
  type: types.CREATE_STUDENT_PROJECT_SUCCESS,
  payload: { project },
})

export const likeStudentProjectRequest = (id: string) => ({
  type: types.LIKE_STUDENT_PROJECT_REQUEST,
  payload: { id },
})

export const likeStudentProjectSuccess = (project: StudentProject) => ({
  type: types.LIKE_STUDENT_PROJECT_SUCCESS,
  payload: { project },
})

export const setStudentProjectFilters = (filters: any) => ({
  type: types.SET_STUDENT_PROJECT_FILTERS,
  payload: { filters },
})

export const fetchStudentProjectsFailure = (error: string) => ({
  type: types.FETCH_STUDENT_PROJECTS_FAILURE,
  payload: { error },
})

// Companies
export const fetchCompaniesRequest = () => ({
  type: types.FETCH_COMPANIES_REQUEST,
})

export const fetchCompaniesSuccess = (companies: Company[]) => ({
  type: types.FETCH_COMPANIES_SUCCESS,
  payload: { companies },
})

export const fetchCompaniesFailure = (error: string) => ({
  type: types.FETCH_COMPANIES_FAILURE,
  payload: { error },
})

export const fetchCompanyByIdRequest = (id: string) => ({
  type: types.FETCH_COMPANY_BY_ID_REQUEST,
  payload: { id },
})

export const fetchCompanyByIdSuccess = (company: Company) => ({
  type: types.FETCH_COMPANY_BY_ID_SUCCESS,
  payload: { company },
})

export const verifyCompanyRequest = (id: string, status: boolean) => ({
  type: types.VERIFY_COMPANY_REQUEST,
  payload: { id, status },
})

export const verifyCompanySuccess = (company: Company) => ({
  type: types.VERIFY_COMPANY_SUCCESS,
  payload: { company },
})

// Students Catalog
export const fetchStudentsRequest = (filters?: any) => ({
  type: types.FETCH_STUDENTS_REQUEST,
  payload: { filters },
})

export const fetchStudentsSuccess = (students: User[]) => ({
  type: types.FETCH_STUDENTS_SUCCESS,
  payload: { students },
})

export const fetchStudentsFailure = (error: string) => ({
  type: types.FETCH_STUDENTS_FAILURE,
  payload: { error },
})

export const inviteStudentRequest = (studentId: string, caseId: string, inviteType: string, message: string) => ({
  type: types.INVITE_STUDENT_REQUEST,
  payload: { studentId, caseId, inviteType, message },
})

export const inviteStudentSuccess = () => ({
  type: types.INVITE_STUDENT_SUCCESS,
})

export const fetchTeamsRequest = () => ({
  type: types.FETCH_TEAMS_REQUEST,
})

export const fetchTeamsSuccess = (teams: ProjectTeam[]) => ({
  type: types.FETCH_TEAMS_SUCCESS,
  payload: { teams },
})

export const createTeamRequest = (data: any) => ({
  type: types.CREATE_TEAM_REQUEST,
  payload: { data },
})

export const createTeamSuccess = (team: ProjectTeam) => ({
  type: types.CREATE_TEAM_SUCCESS,
  payload: { team },
})

// Notifications
export const fetchNotificationsRequest = (userId: string) => ({
  type: types.FETCH_NOTIFICATIONS_REQUEST,
  payload: { userId },
})

export const fetchNotificationsSuccess = (notifications: SystemNotification[]) => ({
  type: types.FETCH_NOTIFICATIONS_SUCCESS,
  payload: { notifications },
})

export const markNotificationReadRequest = (id: string) => ({
  type: types.MARK_NOTIFICATION_READ_REQUEST,
  payload: { id },
})

export const markNotificationReadSuccess = (id: string) => ({
  type: types.MARK_NOTIFICATION_READ_SUCCESS,
  payload: { id },
})

export const markAllNotificationsReadRequest = (userId: string) => ({
  type: types.MARK_ALL_NOTIFICATIONS_READ_REQUEST,
  payload: { userId },
})

export const markAllNotificationsReadSuccess = () => ({
  type: types.MARK_ALL_NOTIFICATIONS_READ_SUCCESS,
})

// Audit
export const fetchAuditLogsRequest = () => ({
  type: types.FETCH_AUDIT_LOGS_REQUEST,
})

export const fetchAuditLogsSuccess = (auditLogs: any[]) => ({
  type: types.FETCH_AUDIT_LOGS_SUCCESS,
  payload: { auditLogs },
})
