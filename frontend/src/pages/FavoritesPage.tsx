import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { useConfirm } from '../components/ConfirmProvider'
import { PaginatedGrid } from '../components/PaginatedGrid'
import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import {
  fetchApplicationsRequest,
  fetchCasesRequest,
  fetchFavoritesRequest,
  toggleFavoriteRequest,
  updateApplicationStatusSuccess,
} from '../store/actions'
import { ProjectSummaryCard } from '../components/ProjectSummaryCard'
import { CatalogSearch } from '../components/CatalogSearch'
import { matchesSearch } from '../utils/publication'
import { InternshipApplications } from '../components/InternshipApplications'

const statusLabels = {
  pending: 'На рассмотрении',
  interview: 'Назначено интервью',
  accepted: 'Принята',
  rejected: 'Отклонена',
  withdrawn: 'Отозвана',
  need_info: 'Нужны уточнения',
}

export const FavoritesPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const confirm = useConfirm()
  const [consentNotice, setConsentNotice] = useState('')
  const [consenting, setConsenting] = useState('')
  const { casesList, favorites, loading, error } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const [search, setSearch] = useState('')
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'favorites' | 'applications' | 'internships'>(
    params.get('tab') === 'applications'
      ? 'applications'
      : params.get('tab') === 'internships'
        ? 'internships'
        : 'favorites',
  )
  useEffect(() => {
    dispatch(fetchCasesRequest())
    dispatch(fetchFavoritesRequest())
  }, [dispatch])
  useEffect(() => {
    if (currentUser?.id) dispatch(fetchApplicationsRequest(undefined, currentUser.id))
  }, [dispatch, currentUser?.id])
  const applications = applicationsList.filter(
    (app) => app.studentId === currentUser?.id || (apiRuntime.mode === 'live' && app.teamId),
  )
  const ids = tab === 'favorites' ? favorites : applications.map((app) => app.caseId)
  const projects = casesList.filter(
    (project) =>
      ids.includes(project.id) &&
      matchesSearch(
        search,
        project.title,
        project.companyName,
        project.direction,
        project.assignedTeamName,
        project.recommendedTech,
      ),
  )
  const entries = projects.flatMap((project) =>
    tab === 'applications'
      ? applications.filter((app) => app.caseId === project.id).map((app) => ({ project, app }))
      : [{ project, app: undefined }],
  )
  return (
    <div>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Заявки и избранное</h1>
        </div>
      </div>
      <div className="tabs-bar mobile-wrap-tabs">
        <button
          className={`tab-btn ${tab === 'favorites' ? 'active' : ''}`}
          onClick={() => setTab('favorites')}
        >
          Избранное ({favorites.length})
        </button>
        <button
          className={`tab-btn ${tab === 'applications' ? 'active' : ''}`}
          onClick={() => setTab('applications')}
        >
          Мои заявки ({applications.length})
        </button>
        <button
          className={`tab-btn ${tab === 'internships' ? 'active' : ''}`}
          onClick={() => setTab('internships')}
        >
          Стажировки и практики
        </button>
      </div>
      {tab === 'internships' ? (
        <InternshipApplications />
      ) : (
        <>
          {consentNotice && <p role="status">{consentNotice}</p>}
          <CatalogSearch
            value={search}
            onChange={setSearch}
            label="Поиск по названию, компании или направлению"
          />
          {loading ? (
            <p role="status">Загрузка…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : (
            <>
              <p aria-live="polite">Найдено проектов: {projects.length}</p>
              <PaginatedGrid>
                {entries.map(({ project, app }) => {
                  return (
                    <ProjectSummaryCard
                      key={app?.id || project.id}
                      teamName={
                        app?.teamName ??
                        (app?.applicantType === 'individual' ? 'Индивидуально' : undefined)
                      }
                      project={project}
                      applicationStatus={
                        tab === 'applications' && app
                          ? app.consentPending
                            ? 'Ожидаются согласия команды'
                            : app.isRegistration && app.status === 'accepted'
                              ? 'Участие подтверждено'
                              : statusLabels[app.status]
                          : undefined
                      }
                      onRemove={
                        tab === 'favorites'
                          ? () => dispatch(toggleFavoriteRequest(project.id))
                          : undefined
                      }
                      extraAction={
                        tab === 'applications' &&
                        app?.canConsent && (
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            disabled={!!consenting}
                            onClick={async () => {
                              if (
                                !(await confirm(
                                  'Подтвердить участие в команде на условиях, указанных в карточке мероприятия?',
                                ))
                              )
                                return
                              setConsenting(app.id)
                              setConsentNotice('')
                              try {
                                const updated = await apiClient.consentApplication(app.id)
                                dispatch(updateApplicationStatusSuccess(updated))
                                setConsentNotice(
                                  updated.isRegistration && updated.status === 'accepted'
                                    ? 'Участие подтверждено. Мероприятие доступно в активных проектах.'
                                    : 'Согласие отправлено.',
                                )
                              } catch (e) {
                                setConsentNotice((e as Error).message)
                              } finally {
                                setConsenting('')
                              }
                            }}
                          >
                            Подтвердить участие
                          </button>
                        )
                      }
                    />
                  )
                })}
              </PaginatedGrid>
              {!projects.length && (
                <div className="card empty-state">
                  <p>
                    {search
                      ? 'По вашему запросу ничего не найдено.'
                      : tab === 'favorites'
                        ? 'Сохраненных кейсов пока нет.'
                        : 'Вы еще не подали заявки.'}
                  </p>
                  <Link to="/cases" className="btn btn-primary btn-sm">
                    Перейти к витрине
                  </Link>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
