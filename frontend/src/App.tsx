import React, { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useAppDispatch, useAppSelector } from './store'
import { fetchCurrentUserRequest } from './store/actions'

// Pages
import { HomePage } from './pages/HomePage'
import { CasesShowcasePage } from './pages/CasesShowcasePage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage'
import { StudentProjectsPage } from './pages/StudentProjectsPage'
import { StudentDetailPage } from './pages/StudentDetailPage'
import { StudentProfilePage } from './pages/StudentProfilePage'
import { StudentsSearchPage } from './pages/StudentsSearchPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { CompanyDetailPage } from './pages/CompanyDetailPage'
import { CompanyApplicationsPage } from './pages/CompanyApplicationsPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ModerationAdminPage } from './pages/ModerationAdminPage'
import { LoginPage } from './pages/LoginPage'
import { WorkspaceListPage } from './pages/WorkspaceListPage'
import { RoleGuard } from './components/layout/RoleGuard'

export const App: React.FC = () => {
  const dispatch = useAppDispatch()
  const { currentUser, isAuthenticated } = useAppSelector((state) => state.auth)

  useEffect(() => {
    dispatch(fetchCurrentUserRequest())
  }, [dispatch])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<LoginPage initialMode="register" />} />

      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="cases" element={<CasesShowcasePage />} />
        <Route path="cases/:id" element={<CaseDetailPage />} />
        <Route path="cases/:id/workspace" element={<ProjectWorkspacePage />} />
        <Route path="workspace" element={<WorkspaceListPage />} />

        <Route path="student-projects" element={<StudentProjectsPage />} />
        <Route path="student-projects/:id" element={<StudentDetailPage />} />

        <Route path="companies" element={<CompaniesPage />} />
        <Route path="company/:id" element={<CompanyDetailPage />} />
        <Route path="company-applications" element={<RoleGuard roles={['company', 'admin']}><CompanyApplicationsPage /></RoleGuard>} />

        <Route path="students-search" element={<StudentsSearchPage />} />
        <Route path="profile/:id" element={<StudentProfilePage />} />
        <Route path="favorites" element={<RoleGuard roles={['student']}><FavoritesPage /></RoleGuard>} />
        <Route path="analytics" element={<RoleGuard roles={['company', 'curator', 'university', 'admin']}><AnalyticsPage /></RoleGuard>} />
        <Route path="moderation" element={<RoleGuard roles={['admin']}><ModerationAdminPage /></RoleGuard>} />
      </Route>

      <Route path="*" element={<Navigate to="/cases" replace />} />
    </Routes>
  )
}
