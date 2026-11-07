import { apiRuntime } from '../../api/runtime'
import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../store'
import { markAllNotificationsReadRequest, markNotificationReadRequest, switchUserRequest } from '../../store/actions'
import { mockServer } from '../../api/mockServer'
import {
  Building2,
  GraduationCap,
  Landmark,
  Settings,
  Bell,
  CheckCheck,
  ClipboardList,
  Menu,
  MessageSquare,
  Info,
  Star,
} from 'lucide-react'

interface TopbarProps {
  onToggleSidebar: () => void
  sidebarExpanded: boolean
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, sidebarExpanded }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const caseId = useMatch('/cases/:id/*')?.params.id
  const { currentUser } = useAppSelector((state) => state.auth)
  const { notificationsList, unreadCount } = useAppSelector((state) => state.notifications)
  const { favorites, activeCase, casesList } = useAppSelector((state) => state.cases)
  const { teamsList } = useAppSelector((state) => state.students)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const infoButtonRef = useRef<HTMLButtonElement>(null)
  const project = caseId ? activeCase?.id === caseId ? activeCase : casesList.find(item=>item.id===caseId) : undefined
  const ownTeams = currentUser?.role==='student'
    ? teamsList.filter(team=>team.leaderId===currentUser.id||team.members.some(member=>member.id===currentUser.id))
    : []
  const projectTeams = project
    ? ownTeams.filter(team=>team.caseId===project.id||applicationsList.some(application=>
      application.caseId===project.id&&application.teamId===team.id&&application.status==='accepted'))
    : ownTeams

  const allUsers = apiRuntime.mode === 'mock' ? mockServer.getUsers() : []
  useEffect(() => setShowInfo(false), [pathname])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAllRead = () => {
    if (currentUser) {
      dispatch(markAllNotificationsReadRequest(currentUser.id))
    }
  }

  const handleNotificationClick = (id: string) => {
    dispatch(markNotificationReadRequest(id))
    const notification = notificationsList.find((item) => item.id === id)
    if (notification?.link?.startsWith('/') && !notification.link.startsWith('//')) { navigate(notification.link); setShowNotifications(false) }
  }

  const handleSwitchUser = (userId: string) => {
    const u = allUsers.find((user) => user.id === userId)
    if (u) {
      dispatch(switchUserRequest(u))
      setShowInfo(false)
      // Immediately navigate to home root so role-specific dashboard appears
      navigate('/')
    }
  }

  return (
    <header className="topbar-isu">
      <div className="topbar-isu__left">
        <button
          className="topbar-isu__hamburger"
          onClick={onToggleSidebar}
          aria-label="Переключить боковое меню"
          aria-controls="main-sidebar"
          aria-expanded={sidebarExpanded}
          title="Свернуть / развернуть меню"
        >
          <Menu size={18} />
        </button>

        {/* Official UUST Date Header matching photo */}
        <div className="topbar-isu__date">
          <span className="date-dot" />
          <span>Сегодня: {new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Yekaterinburg', day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(new Date())}</span>
        </div>
        <span className="topbar-isu__mobile-brand">Витрина IT-проектов</span>
      </div>

      <div className="topbar-isu__right">
        {/* Chat / Messages Icon */}
        <button
          className="topbar-isu__icon-btn"
          title="Сообщения и чаты проектных команд"
          onClick={() => navigate('/workspace')}
        >
          <MessageSquare size={17} />
        </button>

        {/* Role-specific Quick Action in Header */}
        {currentUser?.role === 'student' && (
          <Link
            to="/favorites"
            className="topbar-isu__icon-btn"
            title={`Избранные кейсы (${favorites.length})`}
          >
            <Star size={17} />
          </Link>
        )}

        {currentUser?.role === 'company' && (
          <Link
            to="/company-applications"
            className="topbar-isu__icon-btn"
            title={`Входящие заявки студентов (${applicationsList.filter(a=>['pending','need_info','interview'].includes(a.status)).length})`}
          >
            <ClipboardList size={17} />
          </Link>
        )}

        {/* Notifications Popover */}
        <div className="notifications-wrap" ref={popoverRef}>
          <button
            className="topbar-isu__icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Системные уведомления"
          >
            <Bell size={17} />
            {unreadCount > 0 && <span className="topbar-isu__red-dot" />}
          </button>

          {showNotifications && (
            <div className="notifications-popover">
              <div className="notifications-popover__header">
                <h4>Уведомления ({unreadCount})</h4>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3a75b4',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCheck size={14} /> Прочитать все
                  </button>
                )}
              </div>

              <div className="notifications-popover__list">
                {notificationsList.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    Нет новых уведомлений
                  </div>
                ) : (
                  notificationsList.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notifications-popover__item ${!notif.read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notif.id)}
                    >
                      <div style={{ flex: 1 }}>
                        <div className="notif-title">{notif.title}</div>
                        <div className="notif-desc">{notif.message}</div>
                        <div className="notif-time">{new Date(notif.createdAt).toLocaleDateString('ru-RU')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="topbar-isu__more-wrap" ref={infoRef} onKeyDown={event=>{
          if(event.key==='Escape'&&showInfo){setShowInfo(false);infoButtonRef.current?.focus()}
        }}>
          <button
            ref={infoButtonRef}
            type="button"
            className="topbar-isu__icon-btn"
            onClick={() => setShowInfo(!showInfo)}
            aria-expanded={showInfo}
            aria-controls="topbar-project-info"
            aria-label="Информация о проекте и командах"
            title="Информация о проекте и командах"
          >
            <Info size={17} />
          </button>

          {showInfo && (
            <section id="topbar-project-info" className="topbar-isu__menu-dropdown project-info-popover" aria-label="Информация о проекте и командах">
              <div className="dropdown-title">Проекты и команды</div>
              <div className="project-info-popover__body">
                {project&&<div><Link to={`/cases/${project.id}`} onClick={()=>setShowInfo(false)}><strong>{project.title}</strong></Link><small>{project.companyName}</small></div>}
                {projectTeams.length>0&&<ul>{projectTeams.slice(0,3).map(team=><li key={team.id}>{team.name} <small>{team.members.length} чел.</small></li>)}</ul>}
                <Link to="/workspace" onClick={()=>setShowInfo(false)}>Открыть список проектов</Link>
                {currentUser?.role==='student'&&<Link to="/teams" onClick={()=>setShowInfo(false)}>Мои команды</Link>}
              </div>
              {apiRuntime.mode==='mock'&&<details className="project-info-popover__demo">
              <summary>Демо-профили</summary>
              <button
                className={`dropdown-item ${currentUser?.role === 'student' ? 'active' : ''}`}
                onClick={() => handleSwitchUser('usr_student_1')}
              >
                <GraduationCap size={14} aria-hidden="true" /> Студент (Алмаз Магасумов)
              </button>
              <button
                className={`dropdown-item ${currentUser?.role === 'company' ? 'active' : ''}`}
                onClick={() => handleSwitchUser('usr_company_1')}
              >
                <Building2 size={14} aria-hidden="true" /> Компания (БашНефтеАвтоматика)
              </button>
              <button
                className={`dropdown-item ${currentUser?.role === 'curator' ? 'active' : ''}`}
                onClick={() => handleSwitchUser('usr_curator_1')}
              >
                <Landmark size={14} aria-hidden="true" /> Куратор кафедры
              </button>
              <button
                className={`dropdown-item ${currentUser?.role === 'admin' ? 'active' : ''}`}
                onClick={() => handleSwitchUser('usr_admin_1')}
              >
                <Settings size={14} aria-hidden="true" /> Администратор ИСУ
              </button>
              </details>}
            </section>
          )}
        </div>
      </div>
    </header>
  )
}
