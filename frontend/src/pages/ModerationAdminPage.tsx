import { useTablePagination } from '../components/ReportTableView'
import { IdentityImage } from '../components/IdentityImage'
import { useConfirmWithReason } from '../components/ConfirmProvider'
import { matchesSearch, publicationStatus } from '../utils/publication'
import { auditActionLabels, auditObjectLabels, roleLabels } from '../utils/adminLabels'
import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { InternshipModeration } from '../components/InternshipModeration'
import { AdminInsights } from '../components/AdminInsights'
import { PublicationReviewQueue } from '../components/PublicationReviewQueue'
import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import {
  changeUserRoleRequest,
  fetchAllUsersRequest,
  fetchCasesRequest,
  fetchCompaniesRequest,
  fetchAuditLogsRequest,
  toggleUserBlockRequest,
  verifyCompanyRequest,
} from '../store/actions'
import {
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  History,
  Layers,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'

export const ModerationAdminPage: React.FC = () => {
  const confirm = useConfirmWithReason()
  const dispatch = useAppDispatch()
  const { casesList: allCases } = useAppSelector((state) => state.cases)
  const { companiesList: allCompanies } = useAppSelector((state) => state.companies)
  const { allUsers: users, currentUser } = useAppSelector((state) => state.auth)
  const { auditLogs: logs } = useAppSelector((state) => state.audit)

  const [activeTab, setActiveTab] = useState<
    'cases' | 'opportunities' | 'companies' | 'users' | 'audit'
  >('cases')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [roleBusy, setRoleBusy] = useState(false)
  const [roleMessage, setRoleMessage] = useState('')
  const [roleError, setRoleError] = useState('')
  const live = apiRuntime.mode === 'live'
  const reviewRole = async (userId: string, decision: 'approved' | 'rejected') => {
    if (roleBusy) return
    setRoleBusy(true)
    setRoleMessage('')
    setRoleError('')
    try {
      await apiClient.reviewRoleRequest(userId, decision)
      dispatch(fetchAllUsersRequest())
      dispatch(fetchAuditLogsRequest())
      setRoleMessage(decision === 'approved' ? 'Роль одобрена.' : 'Заявка отклонена.')
    } catch (e) {
      setRoleError((e as Error).message)
    } finally {
      setRoleBusy(false)
    }
  }
  const [detail, setDetail] = useState<{ title: string; fields: [string, string][] } | null>(null)
  const detailRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (detail) detailRef.current?.showModal()
  }, [detail])
  useEffect(() => {
    setSearch('')
    setStatus('all')
  }, [activeTab])
  const matches = (...values: unknown[]) => matchesSearch(search, ...values)
  const pendingCount = allCases.filter((c) => publicationStatus(c) === 'pending').length
  const companiesList = allCompanies.filter(
    (c) =>
      matches(c.id, c.name, c.industry, c.contactPerson, c.email) &&
      (status === 'all' || String(c.isVerified) === status),
  )
  const allUsers = users.filter(
    (u) =>
      matches(u.id, u.fullName, u.email, u.studentProfile?.group) &&
      (status === 'all' || u.role === status),
  )
  const auditLogs = logs.filter(
    (log) =>
      matches(log.id, log.userName, log.actionType, log.objectName, log.objectId, log.details) &&
      (status === 'all' || log.actionType === status),
  )
  const pageFilter = JSON.stringify([search, status])
  const companiesPage = useTablePagination(companiesList, 'Модерация компаний', pageFilter)
  const usersPage = useTablePagination(allUsers, 'Пользователи и роли', pageFilter)
  const auditPage = useTablePagination(auditLogs, 'Журнал аудита', pageFilter)
  const statusOptions =
    activeTab === 'companies'
      ? [
          ['true', 'Верифицирована'],
          ['false', 'Требует проверки'],
        ]
      : activeTab === 'users'
        ? [
            ['student', 'Студент'],
            ['company', 'Компания'],
            ['curator', 'Куратор'],
            ['admin', 'Администратор'],
            ['university', 'Сотрудник'],
          ]
        : [...new Set(logs.map((log) => log.actionType))].map((value) => [
            value,
            auditActionLabels[value] || value,
          ])
  const found = {
    cases: pendingCount,
    opportunities: 0,
    companies: companiesList.length,
    users: allUsers.length,
    audit: auditLogs.length,
  }[activeTab]

  useEffect(() => {
    dispatch(fetchCasesRequest())
    dispatch(fetchCompaniesRequest())
    dispatch(fetchAllUsersRequest())
    dispatch(fetchAuditLogsRequest())
  }, [dispatch])

  const handleVerifyCompany = (companyId: string, status: boolean) => {
    dispatch(verifyCompanyRequest(companyId, status))
  }

  const handleToggleBlock = async (user: (typeof allUsers)[number]) => {
    if (user.id === currentUser?.id) return
    const blocked = !user.isBlocked
    const action = blocked ? 'Заблокировать' : 'Разблокировать'
    const reason = await confirm(
      `${action} пользователя ${user.fullName} (@${user.username})?`,
      action,
      blocked && !live,
      blocked,
    )
    if (reason !== null) dispatch(toggleUserBlockRequest(user, blocked, reason))
  }

  const handleChangeRole = (userId: string, role: any) => {
    if (userId !== currentUser?.id) dispatch(changeUserRoleRequest(userId, role))
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Панель администрирования</h1>
          <p>
            Управление контентом, верификация компаний, модерация кейсов и системный журнал аудита
            действий пользователей.
          </p>
        </div>
      </div>
      <AdminInsights auditLogs={logs} />

      {/* Tabs Bar */}
      <div className="section-tabs">
        <button
          className={`tab-btn ${activeTab === 'cases' ? 'active' : ''}`}
          onClick={() => setActiveTab('cases')}
        >
          <Layers size={16} /> Модерация кейсов
          <span className="tab-counter">{pendingCount}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'opportunities' ? 'active' : ''}`}
          onClick={() => setActiveTab('opportunities')}
        >
          <Layers size={16} /> Стажировки и практики
        </button>

        <button
          className={`tab-btn ${activeTab === 'companies' ? 'active' : ''}`}
          onClick={() => setActiveTab('companies')}
        >
          <Building2 size={16} /> Модерация компаний
          <span className="tab-counter">{companiesList.length}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} /> Пользователи и роли
          <span className="tab-counter">{allUsers.length}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <History size={16} /> Журнал аудита
          <span className="tab-counter">{auditLogs.length}</span>
        </button>
      </div>

      {!['cases', 'opportunities'].includes(activeTab) && (
        <div className="uust-container">
          <div className="uust-box">
            <div className="uust-filter-row">
              <label className="catalog-filter">
                Поиск по текущему разделу
                <input
                  className="uust-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Название, ФИО, email, ID или описание…"
                />
              </label>
              <label className="catalog-filter">
                {activeTab === 'users' ? 'Роль' : activeTab === 'audit' ? 'Операция' : 'Статус'}
                <select
                  className="uust-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Все</option>
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch('')
                  setStatus('all')
                }}
              >
                Сбросить
              </button>
            </div>
            <p aria-live="polite">Найдено записей: {found}</p>
          </div>
        </div>
      )}
      {!['cases', 'opportunities'].includes(activeTab) && found === 0 && (
        <p className="empty-state">Записи по выбранным фильтрам не найдены.</p>
      )}
      {/* TAB 1: CASES MODERATION */}
      {activeTab === 'cases' && <PublicationReviewQueue kind="case" />}
      {activeTab === 'opportunities' && <InternshipModeration />}

      {/* TAB 2: COMPANIES MODERATION */}
      {activeTab === 'companies' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Верификация компаний-партнеров</h3>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th>Отрасль</th>
                    <th>Контактное лицо</th>
                    <th>Сайт</th>
                    <th>Статус верификации</th>
                    <th>Решение</th>
                  </tr>
                </thead>
                <tbody>
                  {companiesPage.items.map((comp) => (
                    <tr key={comp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={comp.logo}
                            alt=""
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                            }}
                          />
                          <Link to={`/company/${comp.id}`}>
                            <strong>{comp.name}</strong>
                          </Link>
                        </div>
                      </td>
                      <td>{comp.industry}</td>
                      <td>{comp.contactPerson}</td>
                      <td>
                        <a
                          href={comp.website}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#1b5e91' }}
                        >
                          {comp.website}
                        </a>
                      </td>
                      <td>
                        {comp.isVerified ? (
                          <span className="badge badge-verified">✓ Верифицирована</span>
                        ) : (
                          <span className="badge badge-complexity-high">Требует проверки</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn ${comp.isVerified ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                          onClick={() => handleVerifyCompany(comp.id, !comp.isVerified)}
                        >
                          {comp.isVerified ? 'Отозвать аккредитацию' : 'Верифицировать'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-table-pagination">{companiesPage.controls}</div>
          </div>
        </div>
      )}

      {/* TAB 3: USERS & ROLES MATRIX */}
      {activeTab === 'users' && (
        <div className="card">
          {roleMessage && (
            <p className="form-hint" role="status">
              {roleMessage}
            </p>
          )}
          {roleError && (
            <p className="form-error" role="alert">
              {roleError}
            </p>
          )}
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              Управление пользователями и ролевая модель
            </h3>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Email / Логин</th>
                    <th>Текущая роль</th>
                    <th>{live ? 'Заявка на роль' : 'Сменить роль'}</th>
                    <th>Статус блокировки</th>
                  </tr>
                </thead>
                <tbody>
                  {usersPage.items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IdentityImage
                            src={u.avatar}
                            name={u.fullName}
                            className="candidate-avatar"
                          />
                          <div>
                            <button
                              className="entity-link"
                              onClick={() =>
                                setDetail({
                                  title: u.fullName,
                                  fields: [
                                    ['ID', u.id],
                                    ['Email', u.email],
                                    ['Телефон', u.phone || '—'],
                                    ['Роль', roleLabels[u.role]],
                                    ['Статус', u.isBlocked ? 'Заблокирован' : 'Активен'],
                                    ['Институт', u.studentProfile?.institute || '—'],
                                    ['Группа', u.studentProfile?.group || '—'],
                                    ['Компания', u.companyProfile?.companyName || '—'],
                                    ['Зарегистрирован', u.createdAt],
                                  ],
                                })
                              }
                            >
                              {u.fullName}
                            </button>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge badge-direction">
                          {u.roleRequestStatus && u.roleRequestStatus !== 'approved'
                            ? 'Без назначенной роли'
                            : roleLabels[u.role]}
                        </span>
                      </td>
                      <td>
                        {live ? (
                          u.roleRequestStatus === 'pending' ? (
                            <div className="action-row">
                              <span>
                                {u.requestedRole === 'university_staff'
                                  ? 'Куратор'
                                  : 'Представитель компании'}
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={roleBusy}
                                onClick={() => reviewRole(u.id, 'approved')}
                              >
                                Одобрить
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={roleBusy}
                                onClick={() => reviewRole(u.id, 'rejected')}
                              >
                                Отклонить
                              </button>
                            </div>
                          ) : u.roleRequestStatus === 'approved' ? (
                            'Одобрена'
                          ) : u.roleRequestStatus === 'rejected' ? (
                            'Отклонена'
                          ) : (
                            '—'
                          )
                        ) : u.id === currentUser?.id ? (
                          'Ваш аккаунт'
                        ) : (
                          <select
                            aria-label={`Роль пользователя ${u.fullName}`}
                            className="select admin-role-select"
                            value={u.role}
                            onChange={(e) => handleChangeRole(u.id, e.target.value as any)}
                          >
                            <option value="student">Студент</option>
                            <option value="company">Компания</option>
                            <option value="curator">Куратор</option>
                            <option value="university">Сотрудник</option>
                            <option value="admin">Администратор</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {u.id === currentUser?.id ? (
                          'Ваш аккаунт'
                        ) : (
                          <button
                            className={`btn ${u.isBlocked ? 'btn-secondary' : 'btn-danger'} btn-sm`}
                            onClick={() => handleToggleBlock(u)}
                          >
                            <Ban size={13} /> {u.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-table-pagination">{usersPage.controls}</div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Журнал аудита критических операций</h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Фиксация: пользователь, дата/время, операция, объект, старое и новое значение
            </span>
          </div>

          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Пользователь</th>
                    <th>Тип операции</th>
                    <th>Объект</th>
                    <th>Предыдущее значение</th>
                    <th>Новое значение</th>
                    <th>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {auditPage.items.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {log.timestamp}
                      </td>
                      <td>
                        <strong>
                          {users.find((user) => user.id === log.userId)?.fullName ||
                            log.userName ||
                            'Не зафиксирован'}
                        </strong>{' '}
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          (
                          {roleLabels[
                            users.find((user) => user.id === log.userId)?.role || log.userRole
                          ] || '—'}
                          )
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-direction" style={{ fontSize: '11px' }}>
                          {auditActionLabels[log.actionType] || log.actionType}
                        </span>
                      </td>
                      <td>
                        <strong>{log.objectName}</strong>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {auditObjectLabels[log.objectType] || log.objectType}
                        </div>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>
                        {roleLabels[log.previousValue || ''] || log.previousValue || '—'}
                      </td>
                      <td style={{ color: '#16805b', fontWeight: 600, fontSize: '12px' }}>
                        {roleLabels[log.newValue || ''] || log.newValue || '—'}
                      </td>
                      <td>
                        <button
                          className="entity-link"
                          onClick={() =>
                            setDetail({
                              title: `Событие: ${log.actionType}`,
                              fields: [
                                ['ID события', log.id],
                                ['Время', log.timestamp],
                                ['Пользователь', log.userName],
                                [
                                  'Роль',
                                  users.find((user) => user.id === log.userId)?.role ||
                                    (live ? '—' : log.userRole),
                                ],
                                ['Операция', log.actionType],
                                ['Тип объекта', log.objectType],
                                ['Объект', log.objectName],
                                ['ID объекта', log.objectId],
                                ['До изменения', log.previousValue || '—'],
                                ['После изменения', log.newValue || '—'],
                                ['Детали', log.details || '—'],
                              ],
                            })
                          }
                        >
                          {log.details || 'Подробнее'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-table-pagination">{auditPage.controls}</div>
          </div>
        </div>
      )}
      <dialog
        ref={detailRef}
        className="object-dialog"
        onCancel={() => setDetail(null)}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <div className="card__header">
              <h2>{detail.title}</h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  detailRef.current?.close()
                  setDetail(null)
                }}
              >
                Закрыть
              </button>
            </div>
            <dl className="detail-fields">
              {detail.fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </dialog>
    </div>
  )
}
