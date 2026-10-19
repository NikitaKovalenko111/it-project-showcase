import React, { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../store'
import { fetchCasesRequest, fetchCompaniesRequest, fetchApplicationsRequest, fetchStudentProjectsRequest, fetchStudentsRequest, fetchTeamsRequest } from '../../store/actions'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export const AppLayout: React.FC = () => {
  const { currentUser, isAuthenticated } = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const previousUser = useRef(currentUser?.id)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isCollapsedDesktop, setIsCollapsedDesktop] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    if (previousUser.current && previousUser.current !== currentUser.id) navigate('/', { replace: true })
    previousUser.current = currentUser.id
    setMobileOpen(false)
    dispatch(fetchCompaniesRequest())
    dispatch(fetchApplicationsRequest())
    dispatch(fetchStudentProjectsRequest())
    dispatch(fetchStudentsRequest())
    dispatch(fetchTeamsRequest())
  }, [currentUser?.id, dispatch, navigate])

  useEffect(() => {
    if (currentUser && pathname !== '/cases') dispatch(fetchCasesRequest())
    if (currentUser && ['/', '/analytics', '/company-applications', '/favorites'].includes(pathname)) {
      dispatch(fetchApplicationsRequest())
    }
    if (currentUser && (pathname === '/' || pathname.startsWith('/profile/'))) {
      dispatch(fetchStudentProjectsRequest())
    }
  }, [currentUser?.id, pathname, dispatch])

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 1024) {
      setMobileOpen((prev) => !prev)
    } else {
      setIsCollapsedDesktop((prev) => !prev)
    }
  }

  if (!isAuthenticated && localStorage.getItem('uust_logged_out') === 'true') return <Navigate to="/login" replace />
  if (!currentUser) return <p role="status">Загрузка профиля...</p>
  return (
    <div className="app-shell">
      <Sidebar
        isOpen={mobileOpen}
        isCollapsedDesktop={isCollapsedDesktop}
        onClose={() => setMobileOpen(false)}
      />
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <div className={`workspace-wrapper ${isCollapsedDesktop ? 'sidebar-collapsed' : ''}`}>
        <Topbar onToggleSidebar={handleToggleSidebar} />
        <main className="main-content">
          <React.Fragment key={currentUser.id}><Outlet /></React.Fragment>
        </main>
      </div>
    </div>
  )
}
