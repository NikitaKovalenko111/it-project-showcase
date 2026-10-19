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
  updateCaseRequest,
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
  const dispatch = useAppDispatch()
  const { casesList: allCases } = useAppSelector((state) => state.cases)
  const { companiesList: allCompanies } = useAppSelector((state) => state.companies)
  const { allUsers: users } = useAppSelector((state) => state.auth)
  const { auditLogs: logs } = useAppSelector((state) => state.audit)

  const [activeTab, setActiveTab] = useState<'cases' | 'companies' | 'users' | 'audit'>('cases')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<{ title: string; fields: [string, string][] } | null>(null)
  const detailRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (detail) detailRef.current?.showModal()
  }, [detail])
  useEffect(() => { setSearch(''); setStatus('all') }, [activeTab])
  const matches = (...values: unknown[]) => values.join(' ').toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))
  const casesList = allCases.filter((c) => matches(c.id, c.title, c.companyName, c.direction) && (status === 'all' || c.status === status))
  const companiesList = allCompanies.filter((c) => matches(c.id, c.name, c.industry, c.contactPerson, c.email) && (status === 'all' || String(c.isVerified) === status))
  const allUsers = users.filter((u) => matches(u.id, u.fullName, u.email, u.studentProfile?.group) && (status === 'all' || u.role === status))
  const auditLogs = logs.filter((log) => matches(log.id, log.userName, log.actionType, log.objectName, log.objectId, log.details) && (status === 'all' || log.actionType === status))
  const statusOptions = activeTab === 'cases' ? [...new Set(allCases.map((c) => c.status))].map((value) => [value, value])
    : activeTab === 'companies' ? [['true', 'Верифицирована'], ['false', 'Требует проверки']]
    : activeTab === 'users' ? [['student', 'Студент'], ['company', 'Компания'], ['curator', 'Куратор'], ['admin', 'Администратор'], ['university', 'Сотрудник УУНиТ']]
    : [...new Set(logs.map((log) => log.actionType))].map((value) => [value, value])
  const found = { cases: casesList.length, companies: companiesList.length, users: allUsers.length, audit: auditLogs.length }[activeTab]

  useEffect(() => {
    dispatch(fetchCasesRequest())
    dispatch(fetchCompaniesRequest())
    dispatch(fetchAllUsersRequest())
    dispatch(fetchAuditLogsRequest())
  }, [dispatch])

  const handleModerateCase = (caseItem: any, newStatus: any) => {
    dispatch(
      updateCaseRequest({
        ...caseItem,
        status: newStatus,
        isModerated: newStatus !== 'moderation',
      })
    )
  }

  const handleVerifyCompany = (companyId: string, status: boolean) => {
    dispatch(verifyCompanyRequest(companyId, status))
  }

  const handleToggleBlock = (userId: string) => {
    dispatch(toggleUserBlockRequest(userId))
  }

  const handleChangeRole = (userId: string, role: any) => {
    dispatch(changeUserRoleRequest(userId, role))
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Панель администрирования</h1>
          <p>
            Управление контентом, верификация компаний, модерация кейсов и системный журнал аудита действий пользователей УУНиТ.
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="section-tabs">
        <button
          className={`tab-btn ${activeTab === 'cases' ? 'active' : ''}`}
          onClick={() => setActiveTab('cases')}
        >
          <Layers size={16} /> Модерация кейсов
          <span className="tab-counter">{casesList.length}</span>
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

      <div className="uust-container"><div className="uust-box">
        <div className="uust-filter-row">
          <label className="catalog-filter">Поиск по текущему разделу<input className="uust-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Название, ФИО, email, ID или описание…" /></label>
          <label className="catalog-filter">{activeTab === 'users' ? 'Роль' : activeTab === 'audit' ? 'Операция' : 'Статус'}
            <select className="uust-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Все</option>
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setStatus('all') }}>Сбросить</button>
        </div>
        <p aria-live="polite">Найдено записей: {found}</p>
      </div></div>
      {found === 0 && <p>Записи по выбранным фильтрам не найдены.</p>}
      {/* TAB 1: CASES MODERATION (п. 5.23 ТЗ) */}
      {activeTab === 'cases' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Модерация ИТ-кейсов компаний и студентов</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Проверка ТЗ, сроков, вознаграждений и контактов</span>
          </div>

          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Название кейса</th>
                    <th>Компания</th>
                    <th>Направление</th>
                    <th>Форма поощрения</th>
                    <th>Текущий статус</th>
                    <th>Действия модератора (п. 5.23)</th>
                  </tr>
                </thead>
                <tbody>
                  {casesList.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/cases/${c.id}`}><strong>{c.title}</strong></Link>
                      </td>
                      <td>{c.companyName}</td>
                      <td>
                        <span className="badge badge-direction">{c.direction}</span>
                      </td>
                      <td>
                        {c.rewardType === 'contest' ? `${c.prizeFund?.toLocaleString()} ₽ (Конкурс)` : c.rewardType}
                      </td>
                      <td>
                        <span
                          className={`badge badge-status ${
                            c.status === 'open'
                              ? 'status-open'
                              : c.status === 'completed'
                              ? 'status-completed'
                              : 'status-in_progress'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleModerateCase(c, 'open')}
                            title="Принять и опубликовать"
                          >
                            <CheckCircle2 size={13} /> Одобрить
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleModerateCase(c, 'moderation')}
                            title="Вернуть на доработку"
                          >
                            <RotateCcw size={13} /> На доработку
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleModerateCase(c, 'archived')}
                            title="Скрыть публикацию"
                          >
                            <XCircle size={13} /> Скрыть
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANIES MODERATION (п. 5.2, 5.23 ТЗ) */}
      {activeTab === 'companies' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Верификация компаний-партнеров УУНиТ</h3>
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
                    <th>Решение УУНиТ</th>
                  </tr>
                </thead>
                <tbody>
                  {companiesList.map((comp) => (
                    <tr key={comp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={comp.logo}
                            alt=""
                            style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
                          />
                          <Link to={`/company/${comp.id}`}><strong>{comp.name}</strong></Link>
                        </div>
                      </td>
                      <td>{comp.industry}</td>
                      <td>{comp.contactPerson}</td>
                      <td>
                        <a href={comp.website} target="_blank" rel="noreferrer" style={{ color: '#1b5e91' }}>
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
          </div>
        </div>
      )}

      {/* TAB 3: USERS & ROLES MATRIX (п. 5.27 ТЗ) */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Управление пользователями и ролевая модель (п. 5.27 ТЗ)</h3>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Email / Логин</th>
                    <th>Текущая роль</th>
                    <th>Сменить роль</th>
                    <th>Статус блокировки</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                            alt=""
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <button className="entity-link" onClick={() => setDetail({ title: u.fullName, fields: [
                              ['ID', u.id], ['Email', u.email], ['Телефон', u.phone || '—'], ['Роль', u.role], ['Статус', u.isBlocked ? 'Заблокирован' : 'Активен'],
                              ['Институт', u.studentProfile?.institute || '—'], ['Группа', u.studentProfile?.group || '—'], ['Компания', u.companyProfile?.companyName || '—'], ['Зарегистрирован', u.createdAt],
                            ] })}>{u.fullName}</button>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge badge-direction">{u.role}</span>
                      </td>
                      <td>
                        <select
                          className="select"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.id, e.target.value as any)}
                        >
                          <option value="student">Студент</option>
                          <option value="company">Компания</option>
                          <option value="curator">Куратор</option>
                          <option value="university">Сотрудник УУНиТ</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </td>
                      <td>
                        <button
                          className={`btn ${u.isBlocked ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                          onClick={() => handleToggleBlock(u.id)}
                        >
                          <Ban size={13} /> {u.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOG (п. 5.26 ТЗ) */}
      {activeTab === 'audit' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              Журнал аудита критических операций (п. 5.26 ТЗ)
            </h3>
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
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {log.timestamp}
                      </td>
                      <td>
                        <strong>{log.userName}</strong>{' '}
                        <span style={{ fontSize: '10px', color: '#64748b' }}>({log.userRole})</span>
                      </td>
                      <td>
                        <span className="badge badge-direction" style={{ fontSize: '11px' }}>
                          {log.actionType}
                        </span>
                      </td>
                      <td>
                        <strong>{log.objectName}</strong>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{log.objectType}</div>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{log.previousValue || '—'}</td>
                      <td style={{ color: '#16805b', fontWeight: 600, fontSize: '12px' }}>
                        {log.newValue || '—'}
                      </td>
                      <td><button className="entity-link" onClick={() => setDetail({ title: `Событие: ${log.actionType}`, fields: [
                        ['ID события', log.id], ['Время', log.timestamp], ['Пользователь', log.userName], ['Роль', log.userRole], ['Операция', log.actionType],
                        ['Тип объекта', log.objectType], ['Объект', log.objectName], ['ID объекта', log.objectId], ['До изменения', log.previousValue || '—'], ['После изменения', log.newValue || '—'], ['Детали', log.details || '—'],
                      ] })}>{log.details || 'Подробнее'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <dialog ref={detailRef} className="object-dialog" onCancel={() => setDetail(null)} onClose={() => setDetail(null)}>
        {detail && <><div className="card__header"><h2>{detail.title}</h2><button className="btn btn-secondary btn-sm" onClick={() => { detailRef.current?.close(); setDetail(null) }}>Закрыть</button></div>
          <dl className="detail-fields">{detail.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </>}
      </dialog>
    </div>
  )
}
