import { UserAvatar } from '../UserAvatar'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
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
  MessageSquare,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '../../types/models'
import { apiRuntime } from '../../api/runtime'
import { hasApprovedCompany } from '../../utils/access'

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
  online: { label: 'В сети', color: 'var(--ui-success-accent)' },
  busy: { label: 'Занят', color: 'var(--ui-warning-accent)' },
  offline: { label: 'Не в сети', color: 'var(--ui-icon)' },
}

const roleLabels: Record<UserRole, string> = {
  student: 'Студент',
  company: 'Компания-партнёр',
  curator: 'Куратор',
  admin: 'Администратор витрины IT-проектов',
  university: 'Администратор ИСУ',
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, isCollapsedDesktop, onClose }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { currentUser } = useAppSelector((state) => state.auth)
  const { favorites } = useAppSelector((state) => state.cases)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const role: UserRole = currentUser?.role || 'student'
  const limitedCompany =
    apiRuntime.mode === 'live' && role === 'company' && !hasApprovedCompany(currentUser)

  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>('online')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const statusControl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || isCollapsedDesktop) setShowStatusMenu(false)
  }, [isOpen, isCollapsedDesktop])

  useEffect(() => {
    if (!showStatusMenu) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !statusControl.current?.contains(event.target))
        setShowStatusMenu(false)
    }
    document.addEventListener('pointerdown', dismiss, true)
    return () => document.removeEventListener('pointerdown', dismiss, true)
  }, [showStatusMenu])

  const closeSidebar = () => {
    setShowStatusMenu(false)
    onClose()
  }

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

  // Role-specific navigation groups
  const navGroups: NavItem[][] = useMemo(() => {
    const opportunities = [{ to: '/internships', label: 'Стажировки и практики', icon: Briefcase }]
    const userId = currentUser?.id || 'me'
    const companyId = currentUser?.companyProfile?.companyId
    const companyPage =
      apiRuntime.mode === 'live' || !companyId ? '/my-company' : `/company/${companyId}`

    switch (role) {
      /* ---------- Student ---------- */
      case 'student':
        return [
          [
            { to: '/', label: 'Главная', icon: Home, end: true },
            { to: '/cases', label: 'Витрина ИТ-кейсов', icon: Briefcase, end: true },
            ...opportunities,
            { to: '/workspace', label: 'Активные проекты', icon: Layers },
            { to: '/teams', label: 'Команды', icon: GraduationCap },
          ],
          [
            { to: '/student-projects', label: 'Проекты студентов', icon: FolderGit2 },
            { to: `/profile/${userId}`, label: 'Мой профиль', icon: GraduationCap },
            {
              to: '/favorites',
              label: 'Заявки и избранное',
              icon: Bookmark,
              badge: favorites.length || undefined,
            },
          ],
          [{ to: '/companies', label: 'Компании-партнёры', icon: Building2 }],
        ]

      /* ---------- Company ---------- */
      case 'company':
        if (limitedCompany) return [[{ to: companyPage, label: 'Моя компания', icon: Building2 }]]
        return [
          [
            { to: '/', label: 'Главная', icon: Home, end: true },
            { to: '/cases', label: 'Мои кейсы', icon: Briefcase, end: true },
            ...opportunities,
            { to: '/workspace', label: 'Активные проекты', icon: Layers },
          ],
          [
            {
              to: '/company-applications',
              label: 'Заявки студентов',
              icon: ClipboardList,
              badge:
                applicationsList.filter((a) =>
                  ['pending', 'need_info', 'interview'].includes(a.status),
                ).length || undefined,
            },
            { to: '/students-search', label: 'Поиск талантов', icon: Search },
          ],
          [
            { to: companyPage, label: 'Моя компания', icon: Building2 },
            { to: '/analytics', label: 'Аналитика кейсов', icon: BarChart3 },
          ],
        ]

      /* ---------- Curator (NO admin panel, NO job invitations) ---------- */
      case 'curator':
        return [
          [
            { to: '/', label: 'Главная', icon: Home, end: true },
            { to: '/cases', label: 'Витрина ИТ-кейсов', icon: Briefcase, end: true },
            ...opportunities,
            { to: '/workspace', label: 'Активные проекты', icon: Layers },
          ],
          [
            { to: '/student-projects', label: 'Проекты студентов', icon: FolderGit2 },
            { to: '/students-search', label: 'Студенты и группы', icon: Search },
            { to: '/companies', label: 'Компании-партнёры', icon: Building2 },
          ],
          [{ to: '/analytics', label: 'Успеваемость и защиты', icon: BarChart3 }],
        ]

      /* ---------- Admin / University ---------- */
      case 'admin':
      case 'university':
      default:
        return [
          [
            { to: '/', label: 'Главная', icon: Home, end: true },
            { to: '/cases', label: 'Витрина ИТ-кейсов', icon: Briefcase, end: true },
            ...opportunities,
            { to: '/workspace', label: 'Активные проекты', icon: Layers },
          ],
          [
            { to: '/student-projects', label: 'Проекты студентов', icon: FolderGit2 },
            { to: '/companies', label: 'Компании-партнёры', icon: Building2 },
            { to: '/students-search', label: 'Поиск талантов', icon: Search },
          ],
          [
            { to: '/analytics', label: 'Аналитика и отчёты', icon: BarChart3 },
            ...(role === 'admin'
              ? [{ to: '/moderation', label: 'Панель администратора', icon: ShieldCheck }]
              : []),
          ],
        ]
    }
  }, [
    role,
    limitedCompany,
    currentUser?.id,
    currentUser?.companyProfile?.companyId,
    favorites.length,
    applicationsList.filter((a) => ['pending', 'need_info', 'interview'].includes(a.status)).length,
  ])

  return (
    <aside
      id="main-sidebar"
      aria-label="Главное меню"
      className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsedDesktop ? 'collapsed' : ''}`}
    >
      <div className="sidebar__uust-brand">
        <div className="uust-crest">
          <img src="/images/brand/mark.svg" alt="" width="38" height="38" />
        </div>
        <div className="uust-brand-text">
          <span className="brand-title">Витрина IT-проектов</span>
        </div>
        <button className="sidebar__close" onClick={closeSidebar} aria-label="Закрыть меню">
          <X size={20} />
        </button>
      </div>

      <div className="sidebar__profile-isu">
        {currentUser && (
          <Link
            className="avatar-wrapper"
            to={role === 'student' ? '/profile/me' : '/account'}
            aria-label="Мой профиль"
            title="Мой профиль"
          >
            <UserAvatar
              userId={currentUser.id}
              src={currentUser.avatar}
              name={currentUser.fullName}
              className="sidebar-avatar"
            />
          </Link>
        )}

        <div className="sidebar__identity">
          <div className="profile-name" title={currentUser?.fullName}>
            {currentUser?.fullName || 'Пользователь'}
          </div>
          <div className="profile-email">Email: {currentUser?.email || 'Не указан'}</div>
        </div>

        <div className="profile-presence">
          {/* Interactive Online Status Pill */}
          <div
            className="profile-status-control"
            ref={statusControl}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || !showStatusMenu) return
              event.stopPropagation()
              setShowStatusMenu(false)
              statusControl.current?.querySelector('button')?.focus()
            }}
          >
            <button
              className="profile-status-pill"
              aria-expanded={showStatusMenu}
              onClick={cycleStatus}
              type="button"
              title="Нажмите, чтобы изменить статус"
            >
              <span className="dot" style={{ backgroundColor: statusConfig[onlineStatus].color }} />
              <span>{statusConfig[onlineStatus].label}</span>
              <ChevronDown size={12} className="chevron" />
            </button>

            {showStatusMenu && (
              <div className="profile-status-menu">
                {(['online', 'busy', 'offline'] as OnlineStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => selectStatus(st)}
                    className={
                      onlineStatus === st ? 'profile-status-option active' : 'profile-status-option'
                    }
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
          <div className="role-pill">
            {role === 'student'
              ? [
                  'Студент',
                  currentUser?.studentProfile?.institute,
                  currentUser?.studentProfile?.group,
                ]
                  .filter(Boolean)
                  .join(' • ')
              : roleLabels[role]}
          </div>
        </div>
      </div>

      <nav className="sidebar__nav-isu">
        {[
          ...navGroups,
          [
            {
              to: '/feedback',
              label: role === 'admin' ? 'Жалобы и обращения' : 'Обратная связь',
              icon: MessageSquare,
            },
          ],
        ].map((group, groupIdx) => (
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
                  onClick={closeSidebar}
                >
                  <span className="nav-icon">
                    <Icon size={15} />
                  </span>
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
      </div>
    </aside>
  )
}
