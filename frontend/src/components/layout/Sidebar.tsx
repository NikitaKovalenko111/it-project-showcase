import React, { useState, useMemo, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../store'
import { logoutRequest } from '../../store/actions'
import {
  BarChart3,
  Bookmark,
  Briefcase,
  Building2,
  ChevronDown,
  ClipboardList,
  FolderGit2,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '../../types/models'

interface SidebarProps {
  isOpen: boolean
  isCollapsedDesktop?: boolean
  onClose: () => void
}

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  end?: boolean
}

type OnlineStatus = 'online' | 'busy' | 'offline'

const statusConfig: Record<OnlineStatus, { label: string; color: string }> = {
  online: { label: 'В сети', color: '#28a745' },
  busy: { label: 'На паре', color: '#e68a19' },
  offline: { label: 'Не в сети', color: '#94a3b8' },
}

const rolePillConfig: Record<UserRole, { text: string; color: string }> = {
  student: { text: 'Студент • ИИМР • ТОП-204Б', color: '#3a75b4' },
  company: { text: 'Компания-партнёр', color: '#e68a19' },
  curator: { text: 'Куратор кафедры', color: '#28a745' },
  admin: { text: 'Администратор ИСУ', color: '#e04646' },
  university: { text: 'Администратор ИСУ', color: '#e04646' },
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, isCollapsedDesktop, onClose }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { currentUser } = useAppSelector((state) => state.auth)
  const { favorites } = useAppSelector((state) => state.cases)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const role: UserRole = currentUser?.role || 'student'

  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>('online')
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(`uust_presence_${currentUser?.id}`)
    setOnlineStatus(stored === 'busy' || stored === 'offline' ? stored : 'online')
    setShowStatusMenu(false)
  }, [currentUser?.id])

  const handleLogout = () => {
    dispatch(logoutRequest())
    navigate('/login')
  }

  const cycleStatus = () => {
    setShowStatusMenu((prev) => !prev)
  }

  const selectStatus = (s: OnlineStatus) => {
    localStorage.setItem(`uust_presence_${currentUser?.id}`, s)
    setOnlineStatus(s)
    setShowStatusMenu(false)
  }

  // Student ID matching user screenshot
  const studentId = currentUser?.id === 'usr_student_1'
    ? '257576'
    : (currentUser?.id ? currentUser.id.replace(/\D/g, '') || '257576' : '257576')

  // Role-specific navigation groups
  const navGroups: NavItem[][] = useMemo(() => {
    const userId = currentUser?.id || 'me'
    const companyId = currentUser?.companyProfile?.companyId || 'comp_1'

    switch (role) {
      /* ---------- Student ---------- */
      case 'student':
        return [
          [
            { to: '/', label: 'ГЛАВНАЯ', icon: Home, end: true },
            { to: '/cases', label: 'ВИТРИНА ИТ-КЕЙСОВ', icon: Briefcase, end: true },
            { to: '/workspace', label: 'РАБОЧАЯ СТАНЦИЯ', icon: Layers },
          ],
          [
            { to: '/student-projects', label: 'ПРОЕКТЫ СТУДЕНТОВ', icon: FolderGit2 },
            { to: `/profile/${userId}`, label: 'МОЁ ПОРТФОЛИО', icon: GraduationCap },
            { to: '/favorites', label: 'ЗАЯВКИ И ИЗБРАННОЕ', icon: Bookmark, badge: favorites.length || undefined },
          ],
          [
            { to: '/companies', label: 'КОМПАНИИ-ПАРТНЁРЫ', icon: Building2 },
          ],
        ]

      /* ---------- Company ---------- */
      case 'company':
        return [
          [
            { to: '/', label: 'ГЛАВНАЯ', icon: Home, end: true },
            { to: '/cases', label: 'МОИ КЕЙСЫ', icon: Briefcase, end: true },
            { to: '/workspace', label: 'РАБОЧАЯ СТАНЦИЯ', icon: Layers },
          ],
          [
            { to: '/company-applications', label: 'ЗАЯВКИ СТУДЕНТОВ', icon: ClipboardList, badge: applicationsList.length || undefined },
            { to: '/students-search', label: 'ПОИСК ТАЛАНТОВ', icon: Search },
          ],
          [
            { to: `/company/${companyId}`, label: 'КАРТОЧКА КОМПАНИИ', icon: Building2 },
            { to: '/analytics', label: 'АНАЛИТИКА ВОРОНКИ', icon: BarChart3 },
          ],
        ]

      /* ---------- Curator (NO admin panel, NO job invitations) ---------- */
      case 'curator':
        return [
          [
            { to: '/', label: 'ГЛАВНАЯ', icon: Home, end: true },
            { to: '/cases', label: 'ВИТРИНА ИТ-КЕЙСОВ', icon: Briefcase, end: true },
            { to: '/workspace', label: 'МОНИТОРИНГ КЕЙСОВ', icon: Layers },
          ],
          [
            { to: '/student-projects', label: 'ПРОЕКТЫ СТУДЕНТОВ', icon: FolderGit2 },
            { to: '/students-search', label: 'СТУДЕНТЫ И ГРУППЫ', icon: Search },
            { to: '/companies', label: 'КОМПАНИИ-ПАРТНЁРЫ', icon: Building2 },
          ],
          [
            { to: '/analytics', label: 'УСПЕВАЕМОСТЬ И ЗАЩИТЫ', icon: BarChart3 },
          ],
        ]

      /* ---------- Admin / University ---------- */
      case 'admin':
      case 'university':
      default:
        return [
          [
            { to: '/', label: 'ГЛАВНАЯ', icon: Home, end: true },
            { to: '/cases', label: 'ВИТРИНА ИТ-КЕЙСОВ', icon: Briefcase, end: true },
            { to: '/workspace', label: 'РАБОЧАЯ СТАНЦИЯ', icon: Layers },
          ],
          [
            { to: '/student-projects', label: 'ПРОЕКТЫ СТУДЕНТОВ', icon: FolderGit2 },
            { to: '/companies', label: 'КОМПАНИИ-ПАРТНЁРЫ', icon: Building2 },
            { to: '/students-search', label: 'ПОИСК ТАЛАНТОВ', icon: Search },
          ],
          [
            { to: '/analytics', label: 'АНАЛИТИКА И ОТЧЁТЫ', icon: BarChart3 },
            { to: '/moderation', label: 'ПАНЕЛЬ АДМИНИСТРАТОРА', icon: ShieldCheck },
          ],
        ]
    }
  }, [role, currentUser?.id, currentUser?.companyProfile?.companyId, favorites.length, applicationsList.length])

  const pillInfo = rolePillConfig[role] ?? rolePillConfig.student

  return (
    <aside id="main-sidebar" aria-label="Главное меню" className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsedDesktop ? 'collapsed' : ''}`}>
      {/* Official UUST ISU Header matching photos */}
      <div className="sidebar__uust-brand">
        <div className="uust-crest">
          <img src="/images/uunit-logo.png" alt="УУНиТ" />
        </div>
        <div className="uust-brand-text">
          <span className="brand-title">Витрина IT-проектов</span>
        </div>
        <button className="sidebar__close" onClick={onClose} aria-label="Закрыть меню"><X size={20} /></button>
      </div>

      {/* UUST Student / User Card from Photo */}
      <div className="sidebar__profile-isu">
        <div className="avatar-wrapper">
          <img
            src={
              currentUser?.avatar ||
              (role === 'company'
                ? 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80'
                : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80')
            }
            alt={currentUser?.fullName || 'Пользователь'}
          />
        </div>

        <div className="profile-name" title={currentUser?.fullName}>
          {currentUser?.fullName || 'Магасумов Алмаз Ильшатович'}
        </div>

        {role !== 'company' && <div className="profile-id">ID:{studentId}</div>}
        <div className="profile-email">
          Email:{currentUser?.email || '257576@stud.uust.ru'}
        </div>

        {/* Interactive Online Status Pill */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            className="profile-status-pill"
            aria-expanded={showStatusMenu}
            onClick={cycleStatus}
            type="button"
            title="Нажмите, чтобы изменить статус"
          >
            <span
              className="dot"
              style={{ backgroundColor: statusConfig[onlineStatus].color }}
            />
            <span>{statusConfig[onlineStatus].label}</span>
            <ChevronDown size={12} className="chevron" />
          </button>

          {showStatusMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '6px',
                background: '#0e2048',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '4px',
                zIndex: 200,
                boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
                width: '130px',
              }}
            >
              {(['online', 'busy', 'offline'] as OnlineStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => selectStatus(st)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: onlineStatus === st ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: 'none',
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: statusConfig[st].color,
                    }}
                  />
                  <span>{statusConfig[st].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Role pill */}
        <div className="role-pill" style={{ borderLeftColor: pillInfo.color }}>
          {pillInfo.text}
        </div>
      </div>

      {/* UUST Navigation in ISU Style */}
      <nav className="sidebar__nav-isu">
        {navGroups.map((group, groupIdx) => (
          <React.Fragment key={groupIdx}>
            {groupIdx > 0 && <div className="sidebar__nav-divider" />}
            {group.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar__link-isu ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="nav-icon"><Icon size={15} /></span>
                  <span>{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="nav-badge-isu">{item.badge}</span>
                  )}
                </NavLink>
              )
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar__footer-isu">
        <button className="logout-btn-isu" onClick={handleLogout} title="Выйти из системы">
          <LogOut size={14} />
          <span>Выйти</span>
        </button>
        <div className="sidebar-version-tag">
          2026
        </div>
      </div>
    </aside>
  )
}
