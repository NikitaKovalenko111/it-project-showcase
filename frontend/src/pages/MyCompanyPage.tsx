import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { companyMembershipApi, storeCompanyMemberships } from '../api/client'
import { companyStatuses, type CompanyMemberInvitation } from '../api/companyMembership'
import { CompanyEditor } from '../components/CompanyEditor'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCompaniesRequest, fetchCurrentUserSuccess } from '../store/actions'
import type { Company } from '../types/models'

export function MyCompanyPage() {
  const user = useAppSelector((state) => state.auth.currentUser)!
  const dispatch = useAppDispatch()
  const [params, setParams] = useSearchParams()
  const invitationId = params.get('invitation')
  const invitationsOpen = params.get('view') === 'invitations' || !!invitationId
  const [editor, setEditor] = useState<'create' | 'edit'>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const companies = user.memberCompanies ?? []
  const selected = companies.find((company) => company.id === user.companyProfile?.companyId)
  const awaitingCompany = selected?.status === 'pending'
  const refreshVersion = useRef(0)

  useEffect(() => {
    const sync = async () => {
      const version = ++refreshVersion.current
      try {
        const rows = await companyMembershipApi.listMine()
        if (version === refreshVersion.current) {
          dispatch(fetchCurrentUserSuccess(storeCompanyMemberships(user, rows)))
          setError('')
        }
      } catch (cause) {
        if (version === refreshVersion.current) setError((cause as Error).message)
      }
    }
    void sync()
    const timer = awaitingCompany ? window.setInterval(sync, 20_000) : undefined
    return () => {
      refreshVersion.current++
      window.clearInterval(timer)
    }
  }, [dispatch, user.id, awaitingCompany])

  const applyCompany = (company: Company) => {
    refreshVersion.current++
    const rows = [...companies.filter((item) => item.id !== company.id), company]
    dispatch(fetchCurrentUserSuccess(storeCompanyMemberships(user, rows, company.id)))
    dispatch(fetchCompaniesRequest())
  }

  const refresh = async (preferredId?: string) => {
    const version = ++refreshVersion.current
    setBusy(true)
    setError('')
    try {
      const rows = await companyMembershipApi.listMine()
      if (version === refreshVersion.current)
        dispatch(fetchCurrentUserSuccess(storeCompanyMemberships(user, rows, preferredId)))
    } catch (cause) {
      if (version === refreshVersion.current) setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (company: Company) => {
    setBusy(true)
    setError('')
    try {
      applyCompany(await companyMembershipApi.submit(company.id))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-header__content">
          <h1>Моя компания</h1>
        </div>
        <div className="action-row">
          <button
            className="btn btn-secondary"
            aria-expanded={invitationsOpen}
            onClick={() => setParams(invitationsOpen ? {} : { view: 'invitations' })}
          >
            Входящие приглашения
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => setEditor('create')}>
            Создать компанию
          </button>
        </div>
      </header>

      {invitationsOpen && (
        <CompanyInvitations
          key={invitationId || 'inbox'}
          invitationId={invitationId}
          disabled={busy}
          onAccepted={(company) => {
            applyCompany(company)
            void refresh(company.id)
          }}
        />
      )}

      <section className="card feature-panel">
        {companies.length > 1 && (
          <label className="form-group">
            Активная компания
            <select
              className="select"
              value={selected?.id || ''}
              disabled={busy}
              onChange={(event) =>
                dispatch(
                  fetchCurrentUserSuccess(
                    storeCompanyMemberships(user, companies, event.target.value),
                  ),
                )
              }
            >
              {companies.map((company) => (
                <option value={company.id} key={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {selected ? (
          <>
            <div className="feature-toolbar">
              <h2>{selected.name}</h2>
              {selected.status && <span className="badge">{companyStatuses[selected.status]}</span>}
            </div>
            {selected.status === 'draft' && (
              <p>Отправьте компанию на модерацию, чтобы открыть рабочий кабинет.</p>
            )}
            {selected.status === 'pending' && (
              <p>
                Ожидайте решения администратора. После одобрения откроются публикации, заявки и
                аналитика.
              </p>
            )}
            {selected.status === 'rejected' && (
              <p>Исправьте данные компании и отправьте её на повторную проверку.</p>
            )}
            <div className="action-row">
              <Link className="btn btn-secondary" to={`/company/${selected.id}`}>
                Открыть карточку
              </Link>
              {selected.status !== 'suspended' && selected.status !== 'pending' && (
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setEditor('edit')}
                >
                  Редактировать
                </button>
              )}
              {(selected.status === 'draft' || selected.status === 'rejected') && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void submit(selected)}
                >
                  Отправить на модерацию
                </button>
              )}
              {selected.isVerified && !selected.isBlocked && (
                <Link className="btn btn-primary" to="/">
                  Открыть рабочий кабинет
                </Link>
              )}
              <button className="btn btn-secondary" disabled={busy} onClick={() => void refresh()}>
                Обновить статус
              </button>
            </div>
          </>
        ) : (
          <p>Создайте компанию или примите приглашение, чтобы присоединиться к существующей.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="card feature-panel">
        <h2>Ваш ID представителя</h2>
        <p>Передайте этот ID представителю компании, который хочет вас пригласить.</p>
        <div className="action-row">
          <input
            className="input"
            readOnly
            aria-label="Ваш ID представителя"
            value={user.id}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(user.id)
                setCopyStatus('ID скопирован.')
              } catch {
                setCopyStatus('Выделите ID и скопируйте его вручную.')
              }
            }}
          >
            Скопировать ID
          </button>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
      </section>

      {editor && (
        <CompanyEditor
          company={editor === 'edit' ? selected : undefined}
          onClose={() => setEditor(undefined)}
          onSaved={(company) => {
            applyCompany(company)
            setEditor(undefined)
          }}
        />
      )}
    </div>
  )
}

function CompanyInvitations({
  invitationId,
  disabled,
  onAccepted,
}: {
  invitationId: string | null
  disabled: boolean
  onAccepted: (company: Company) => void
}) {
  const latestNotice = useAppSelector(
    (state) =>
      state.notifications.notificationsList.find(
        (item) => item.type === 'company_member_invitation',
      )?.id,
  )
  const [items, setItems] = useState<CompanyMemberInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    companyMembershipApi
      .listInvitations()
      .then((rows) => {
        if (active) setItems(rows)
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [latestNotice, reload])

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    setResponding(true)
    setError('')
    setNotice('')
    try {
      const company = await companyMembershipApi.respond(id, status)
      setItems((current) => current.filter((item) => item.invitation_id !== id))
      if (status === 'accepted') onAccepted(company)
      setNotice(
        status === 'accepted'
          ? `Вы присоединились к компании «${company.name}».`
          : 'Приглашение отклонено.',
      )
      setReload((value) => value + 1)
    } catch (cause) {
      const failure = cause as Error & { status?: number; code?: string }
      setError(
        failure.code === 'invalid_status' || failure.status === 404
          ? 'Приглашение уже обработано или компания сейчас недоступна. Список обновлён.'
          : failure.code === 'representative_approval_required'
            ? 'Для принятия приглашения нужна одобренная роль представителя.'
            : failure.message,
      )
      if (failure.code === 'invalid_status' || failure.status === 404)
        setReload((value) => value + 1)
    } finally {
      setResponding(false)
    }
  }

  const ordered = invitationId
    ? [
        ...items.filter((item) => item.invitation_id === invitationId),
        ...items.filter((item) => item.invitation_id !== invitationId),
      ]
    : items
  return (
    <section className="card feature-panel">
      <div className="feature-toolbar">
        <h2>Входящие приглашения</h2>
        <button
          className="btn btn-secondary"
          disabled={loading || responding}
          onClick={() => {
            setError('')
            setReload(reload + 1)
          }}
        >
          Обновить
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Загружаем приглашения…</p>
      ) : (
        <>
          {invitationId &&
          !ordered.some((item) => item.invitation_id === invitationId) &&
          !notice ? (
            <p>Это приглашение больше не ожидает ответа.</p>
          ) : (
            ordered.length === 0 && <p>Новых приглашений нет.</p>
          )}
          {ordered.map((item) => (
            <div className="card feature-panel" key={item.invitation_id}>
              <h3>{item.company_name}</h3>
              {item.position && <p>Должность: {item.position}</p>}
              {item.permissions?.includes('manage_company') && (
                <p>Приглашение даёт право управлять компанией.</p>
              )}
              <div className="action-row">
                <button
                  className="btn btn-primary"
                  disabled={disabled || responding}
                  onClick={() => void respond(item.invitation_id, 'accepted')}
                >
                  Принять
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={disabled || responding}
                  onClick={() => void respond(item.invitation_id, 'declined')}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
