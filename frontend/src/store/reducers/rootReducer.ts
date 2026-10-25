import { combineReducers } from 'redux'
import { authReducer } from './authReducer'
import { casesReducer } from './casesReducer'
import { studentProjectsReducer } from './studentProjectsReducer'
import { companiesReducer } from './companiesReducer'
import { applicationsReducer } from './applicationsReducer'
import { studentsReducer } from './studentsReducer'
import { notificationsReducer } from './notificationsReducer'
import { auditReducer } from './auditReducer'

const combinedReducer = combineReducers({
  auth: authReducer,
  cases: casesReducer,
  studentProjects: studentProjectsReducer,
  companies: companiesReducer,
  applications: applicationsReducer,
  students: studentsReducer,
  notifications: notificationsReducer,
  audit: auditReducer,
})

export const rootReducer = (state: ReturnType<typeof combinedReducer> | undefined, action: any) => {
  if (action.type === 'auth/SWITCH_USER_SUCCESS' || action.type === 'auth/LOGOUT_SUCCESS' || action.type === 'auth/LOGIN_SUCCESS') {
    return combinedReducer(undefined, action)
  }
  return combinedReducer(state, action)
}

export type RootState = ReturnType<typeof combinedReducer>
