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
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= 1024)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth <= 1024)
      if (window.innerWidth > 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const sidebar = document.getElementById('main-sidebar')
    sidebar?.querySelector<HTMLButtonElement>('.sidebar__close')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(sidebar?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]') || [])
        .filter((element) => element.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [mobileOpen])

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
        <Topbar onToggleSidebar={handleToggleSidebar} sidebarExpanded={isMobileViewport ? mobileOpen : !isCollapsedDesktop} />
        <main className="main-content">
          <React.Fragment key={currentUser.id}><Outlet /></React.Fragment>
        </main>
      </div>
    </div>
  )
}
