import { createId } from '../../utils/id'
import { LocalizedFileInput } from '../LocalizedFileInput'
import { Modal } from '../Modal'
import { axiosInstance } from '../../api/http'
import { clearFieldError, markFieldError, reportFieldError } from '../../utils/formValidation'
import { localDate, localDayEnd } from '../../utils/date'
import { apiRuntime } from '../../api/runtime'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, X } from 'lucide-react'
import { OpportunityPublicationModal, type OpportunityKind } from './OpportunityPublicationModal'
import { apiClient } from '../../api/client'
import { uploadFile } from '../../utils/files'
import { useAppDispatch, useAppSelector } from '../../store'
import { createCaseSuccess, updateCaseSuccess } from '../../store/actions'
import {
  CaseProject,
  CaseKind,
  CaseComplexity,
  Company,
  ParticipationFormat,
  ProjectDirection,
  WorkFormat,
} from '../../types/models'
import { legacyCriteria } from '../../utils/evaluation'
import {
  CaseFields,
  HackathonFields,
  OlympiadFields,
  InternshipFields,
  PublicationDetails,
} from '../PublicationFields'

const live = apiRuntime.mode === 'live'
const olympiadSubjects = ['Математика', 'Программирование', 'Физика', 'Информатика', 'Другое']

type CreateCaseProps = {
  caseItem?: CaseProject
  initialCompanyId?: string
  isOpen: boolean
  onClose: () => void
}

export const CreateCaseModal: React.FC<CreateCaseProps> = (props) =>
  props.isOpen ? <CreateCaseForm {...props} /> : null

const CreateCaseForm: React.FC<CreateCaseProps> = ({
  caseItem,
  initialCompanyId,
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<CaseProject>()
  const [ndaText, setNdaText] = useState('')
  const [opportunity, setOpportunity] = useState<OpportunityKind>()
  const [opportunityNotice, setOpportunityNotice] = useState('')
  const user = useAppSelector((s) => s.auth.currentUser)
  const catalogCompanies = useAppSelector((s) => s.companies.companiesList)
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyError, setCompanyError] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const publisher = user?.role === 'company' || user?.role === 'admin'
  useEffect(() => {
    if (!user || !publisher || caseItem) return
    let active = true
    setCompanies([])
    setCompanyError('')
    setLoadingCompanies(true)
    void apiClient
      .getPublicationCompanies(user)
      .then((rows) => {
        if (active) setCompanies(rows)
      })
      .catch(() => {
        if (active) setCompanyError('Не удалось загрузить компании. Откройте форму повторно.')
      })
      .finally(() => {
        if (active) setLoadingCompanies(false)
      })
    return () => {
      active = false
    }
  }, [user, publisher, caseItem])
  const [kind, setKind] = useState<CaseKind>('case'),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [short, setShort] = useState('')
  const [complexity, setComplexity] = useState<CaseComplexity>('Средний')
  const [selectedCompanyId, setSelectedCompanyId] = useState(''),
    [direction, setDirection] = useState<ProjectDirection | ''>(live ? '' : 'Frontend'),
    [deadline, setDeadline] = useState('')
  const admin = user?.role === 'admin'
  const companyOptions = publisher ? companies : catalogCompanies
  const existingPublication = caseItem || draft
  const companyId =
    existingPublication?.companyId ||
    (admin &&
      companyOptions.find((item) => item.id === (selectedCompanyId || initialCompanyId))?.id) ||
    companyOptions.find((item) => item.id === user?.companyProfile?.companyId)?.id ||
    companyOptions[0]?.id ||
    ''
  const company = existingPublication
    ? {
        id: existingPublication.companyId,
        name: existingPublication.companyName,
        logo: existingPublication.companyLogo,
      }
    : companyOptions.find((item) => item.id === companyId)
  const companyUnavailable = !existingPublication && publisher && !company
  const companyHint = loadingCompanies
    ? 'Загружаем компании…'
    : companyError ||
      (admin
        ? 'Нет одобренных компаний для публикации.'
        : 'К аккаунту не привязана доступная компания.')
  const [serverDirections, setServerDirections] = useState<string[]>([])
  const [serverSkills, setServerSkills] = useState<string[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [catalogError, setCatalogError] = useState('')
  useEffect(() => {
    if (!isOpen || !live) return
    let active = true
    setCatalogError('')
    const getNames = async (catalog: string): Promise<string[]> =>
      (await axiosInstance.get(`/catalogs/${catalog}`)).data.items.map(
        (item: { name: string }) => item.name,
      )
    Promise.all([getNames('directions'), getNames('competencies')])
      .then(([directions, competencies]) => {
        if (!active) return
        setServerDirections(directions)
        setServerSkills(competencies)
      })
      .catch(() => {
        if (active) setCatalogError('Не удалось загрузить справочники. Откройте форму повторно.')
      })
    return () => {
      active = false
    }
  }, [isOpen])
  const [format, setFormat] = useState<WorkFormat>('дистанционный'),
    [skills, setSkills] = useState(''),
    [rules, setRules] = useState(''),
    [prizeInput, setPrize] = useState('')
  const [participation, setParticipation] = useState<ParticipationFormat>('team')
  const [teamMinInput, setTeamMin] = useState('2'),
    [teamMaxInput, setTeamMax] = useState('5'),
    [limit, setLimit] = useState(''),
    [nda, setNda] = useState(false)
  const prize = Number(prizeInput)
  const teamMin = Number(teamMinInput)
  const teamMax = Number(teamMaxInput)
  const maxPrize = 999999999999.99
  const normalizeNumber = (value: string) =>
    value && Number.isFinite(Number(value)) ? String(Number(value)) : value
  const [criteria, setCriteria] = useState<
    { id: string; label: string; weight: number; maxScore?: number }[]
  >([{ id: createId(), label: 'Качество решения', weight: 1, maxScore: 10 }])
  const [tasks, setTasks] = useState<{ id: string; title: string; maxScore: number }[]>(
    caseItem?.olympiadTasks || [{ id: createId(), title: 'Задача A', maxScore: 100 }],
  )
  const [spec, setSpec] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [details, setDetails] = useState<PublicationDetails>({
    startDate: '',
    venue: '',
    schedule: '',
    position: '',
    workload: '',
    selection: '',
  })
  useEffect(() => {
    if (!isOpen) return
    setError('')
    setDraft(undefined)
    setNdaText('')
    setOpportunity(undefined)
    setOpportunityNotice('')
    setSpec(null)
    setCover(null)
    setKind(caseItem?.kind || 'case')
    setSelectedSkills(caseItem?.requiredCompetencies || [])
    if (caseItem) {
      setTasks(caseItem.olympiadTasks || [])
      setKind(caseItem.kind || 'case')
      setTitle(caseItem.title)
      setComplexity(caseItem.complexity)
      setDescription(caseItem.fullDescription)
      setShort(caseItem.shortDescription)
      setDirection(caseItem.direction)
      setDeadline(caseItem.deadlineDate)
      setFormat(caseItem.workFormat)
      setSkills(caseItem.requiredCompetencies.join(', '))
      setRules(caseItem.olympiadRules || caseItem.internshipConditions || '')
      setPrize(String(caseItem.prizeFund || caseItem.rewardAmount || ''))
      setParticipation(caseItem.participationFormat)
      setTeamMin(String(caseItem.teamSize.min))
      setTeamMax(String(caseItem.teamSize.max))
      setLimit(caseItem.maxTeams ? String(caseItem.maxTeams) : '')
      setNda(caseItem.isConfidential)
      setCriteria(caseItem.evaluationCriteria || legacyCriteria)
      if (caseItem.publicationDetails) setDetails(caseItem.publicationDetails)
    }
  }, [isOpen, caseItem, user?.id])
  if (!isOpen) return null
  const dialog = (content: React.ReactNode, label = 'Размещение публикации') => (
    <Modal
      title={label}
      bare
      className={
        opportunityNotice ? 'publication-confirmation' : 'modal-dialog--lg publication-dialog'
      }
      busy={busy}
      onClose={onClose}
    >
      {content}
    </Modal>
  )
  const formatControl = (
    <label>
      Формат публикации
      <select
        className="select"
        disabled={!!caseItem || !!draft}
        value={opportunity || kind}
        onChange={(event) => {
          const next = event.target.value
          if (live && (next === 'internship' || next === 'practice')) {
            setOpportunity(next)
            return
          }
          setOpportunity(undefined)
          setKind(next as CaseKind)
          setDirection(live ? '' : next === 'olympiad' ? 'Математика' : 'Frontend')
        }}
      >
        <option value="hackathon">Хакатон</option>
        <option value="olympiad">Олимпиада</option>
        <option value="case">Кейс · отбор исполнителей</option>
        {(!live || ['company', 'admin'].includes(user?.role || '')) && (
          <option value="internship">Стажировка</option>
        )}
        {live && ['company', 'admin'].includes(user?.role || '') && (
          <option value="practice">Практика</option>
        )}
      </select>
    </label>
  )
  if (opportunityNotice)
    return dialog(
      <>
        <div className="modal-dialog__body">
          <h3 role="status">{opportunityNotice}</h3>
          <p>
            {opportunityNotice.startsWith('Черновик')
              ? 'Продолжить редактирование можно в списке своих публикаций.'
              : 'Статус можно проверить в списке своих публикаций.'}
          </p>
        </div>
        <footer className="modal-dialog__footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Готово
          </button>
        </footer>
      </>,
    )
  if (opportunity)
    return dialog(
      <OpportunityPublicationModal
        key={opportunity}
        embedded
        onBusyChange={setBusy}
        initial={{ kind: opportunity, company_id: companyId }}
        companies={admin ? companyOptions : companyOptions.filter((item) => item.id === companyId)}
        allowCompanySelection={admin}
        companyUnavailable={companyUnavailable ? companyHint : undefined}
        onCompanyChange={setSelectedCompanyId}
        formatControl={formatControl}
        onClose={onClose}
        onSaved={(_, submitted) =>
          setOpportunityNotice(
            submitted ? 'Публикация отправлена на модерацию.' : 'Черновик сохранён.',
          )
        }
      />,
    )
  const internship = kind === 'internship',
    olympiad = kind === 'olympiad',
    participationFormat = internship ? 'individual' : participation
  const liveEvent = live && (olympiad || kind === 'hackathon')
  const today = localDate()
  const team = participationFormat !== 'individual'
  const initialRegistrationDay = caseItem?.applicationDeadline
    ? localDate(new Date(caseItem.applicationDeadline))
    : ''
  const canSaveNdaVersion = !caseItem || ['draft', 'revision'].includes(caseItem.status)
  const directionOptions = live
    ? olympiad
      ? serverDirections.filter((value) => olympiadSubjects.includes(value))
      : serverDirections
    : olympiad
      ? olympiadSubjects
      : [
          'Frontend',
          'Backend',
          'Fullstack',
          'Data Science',
          'Искусственный интеллект',
          'IoT',
          'UX/UI',
          'Информационная безопасность',
        ]
  const showDirection = !live || directionOptions.length > 0 || !!direction
  const name = internship
    ? 'стажировки'
    : olympiad
      ? 'олимпиады'
      : kind === 'case'
        ? 'кейса'
        : 'хакатона'
  return dialog(
    <>
      <header className="modal-dialog__header">
        <div>
          <h3>
            {caseItem ? 'Редактирование' : 'Размещение'} {name}
          </h3>
          <p>
            {live && !caseItem
              ? 'Сохраните черновик, чтобы настроить этапы до модерации.'
              : 'Публикация появится в витрине после модерации.'}
          </p>
        </div>
        <button className="close-btn" aria-label="Закрыть" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <form
        onInput={clearFieldError}
        onInvalid={markFieldError}
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          const form = e.currentTarget
          const fields = new FormData(form)
          const deadline = String(fields.get('deadline') || '')
          const registrationDeadline = String(fields.get('registrationDeadline') || '')
          for (const [name, label] of [
            ['title', 'название'],
            ['summary', 'краткое описание'],
            ['description', 'техническое задание'],
          ]) {
            if (!String(fields.get(name) || '').trim()) {
              reportFieldError(form, name, `Заполните ${label}.`)
              return
            }
          }
          if (
            live &&
            team &&
            !olympiad &&
            nda &&
            (!caseItem || !caseItem.isConfidential) &&
            !ndaText.trim()
          ) {
            reportFieldError(form, 'ndaText', 'Введите текст соглашения.')
            return
          }
          setBusy(true)
          setError('')
          try {
            const submit =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'draft'
            if (!company) throw new Error('Выберите компанию')
            if (
              team &&
              (!Number.isInteger(teamMin) ||
                !Number.isInteger(teamMax) ||
                teamMin < 1 ||
                teamMax < 2 ||
                teamMax > 100 ||
                teamMin > teamMax)
            )
              throw new Error(
                'Укажите размер команды от 1 до 100 человек. Максимум должен быть не меньше двух и не меньше минимума.',
              )
            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
              deadline < '2020-01-01' ||
              deadline > '2100-12-31' ||
              !Number.isFinite(Date.parse(deadline))
            )
              throw new Error('Укажите корректный дедлайн: 2020–2100 год')
            if (
              live &&
              (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 10000)
            )
              throw new Error('Укажите лимит от 1 до 10 000.')
            if (deadline < today && (submit || deadline !== caseItem?.deadlineDate))
              throw new Error('Дедлайн не может быть в прошлом.')
            if (![title, short, description].every((value) => value.trim()))
              throw new Error('Заполните название, краткое описание и техническое задание.')
            if ((liveEvent && !registrationDeadline) || registrationDeadline > deadline)
              throw new Error('Срок подачи заявок должен быть не позднее даты завершения.')
            if (details.startDate && deadline && details.startDate > deadline)
              throw new Error('Начало должно быть не позднее даты завершения')
            if (
              !olympiad &&
              !internship &&
              (!criteria.length ||
                criteria.some(
                  (c) =>
                    !c.label.trim() ||
                    !Number.isFinite(c.maxScore ?? 10) ||
                    (c.maxScore ?? 10) <= 0,
                ))
            )
              throw new Error('Заполните критерии с положительными максимумами баллов')
            if (
              olympiad &&
              !live &&
              (!tasks.length ||
                tasks.some(
                  (t) => !t.title.trim() || !Number.isFinite(t.maxScore) || t.maxScore <= 0,
                ))
            )
              throw new Error('Добавьте задачи с положительным максимумом баллов')
            const specificationFile = spec ? await uploadFile(spec) : caseItem?.specificationFile
            const file = cover ? await uploadFile(cover) : undefined
            const payload: Omit<
              CaseProject,
              'id' | 'viewsCount' | 'applicationsCount' | 'publishedAt'
            > = {
              specificationFile,
              kind,
              title,
              companyId: company.id,
              companyName: company.name,
              companyLogo: company.logo,
              shortDescription: short,
              fullDescription: description,
              direction: direction as ProjectDirection,
              complexity,
              participationFormat,
              teamSize: team ? { min: teamMin, max: teamMax } : { min: 1, max: 1 },
              maxTeams: limit ? Number(limit) : null,
              requiredCompetencies: live
                ? selectedSkills
                : skills
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
              recommendedTech:
                team && !olympiad
                  ? skills
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [],
              deadlineDate: deadline,
              duration: live
                ? caseItem?.duration || ''
                : internship
                  ? details.workload
                  : `С ${details.startDate} по ${deadline}`,
              workFormat: format,
              resultRequirements: internship
                ? 'Отчёт о стажировке и материалы выполненных задач'
                : olympiad
                  ? 'Решения заданий по турам и пояснения'
                  : 'Прототип, презентация и демонстрация решения',
              evaluationOrder: olympiad
                ? rules
                : internship
                  ? 'Отбор кандидатов по требованиям компании'
                  : caseItem?.evaluationOrder || `Оценка по ${criteria.length} критериям`,
              olympiadTasks: olympiad && !live ? tasks : undefined,
              applicationDeadline:
                live && registrationDeadline
                  ? registrationDeadline === initialRegistrationDay
                    ? caseItem?.applicationDeadline
                    : localDayEnd(registrationDeadline)
                  : caseItem?.applicationDeadline,
              evaluationCriteria: internship
                ? []
                : olympiad
                  ? caseItem?.evaluationCriteria || []
                  : live
                    ? criteria
                    : caseItem?.evaluationCriteria || criteria,
              publicationDetails: details,
              internshipConditions: internship ? rules : undefined,
              olympiadRules: olympiad ? rules : undefined,
              rewardType: internship ? 'monetary' : 'contest',
              rewardAmount: internship ? prize : undefined,
              prizeFund: internship ? undefined : prize,
              rewardDescription: internship
                ? `Вознаграждение за месяц: ${prize} ₽`
                : `Призовой фонд: ${prize} ₽`,
              paymentStatus: prize ? 'pending' : 'not_provided',
              status: 'moderation',
              isConfidential: !olympiad && team && nda,
              ipRights: caseItem?.ipRights || 'author',
              isModerated: false,
              moderationStatus: 'pending',
              coverUrl: file?.url || caseItem?.coverUrl || draft?.coverUrl,
              coverFileId: file?.file_id || caseItem?.coverFileId || draft?.coverFileId,
            }
            const existing = caseItem || draft
            let saved = existing
              ? await apiClient.updateCase({
                  ...existing,
                  ...payload,
                  status: existing.status,
                  isModerated: existing.isModerated,
                  moderationStatus: existing.moderationStatus,
                })
              : await apiClient.createCase(
                  live ? { ...payload, coverFileId: undefined } : payload,
                  false,
                )
            if (live) {
              if (!caseItem) setDraft(saved)
              dispatch(existing ? updateCaseSuccess(saved) : createCaseSuccess(saved))
              if (!existing && payload.coverFileId) {
                await axiosInstance.put(`/cases/${saved.id}/cover`, {
                  file_id: payload.coverFileId,
                })
                saved = await apiClient.getCaseById(saved.id)
                setDraft(saved)
              }
              if (payload.isConfidential && ndaText.trim()) {
                await axiosInstance.post(`/cases/${saved.id}/nda-versions`, {
                  text: ndaText.trim(),
                })
              }
              if (!liveEvent && submit && !caseItem) saved = await apiClient.submitCase(saved.id)
              dispatch(updateCaseSuccess(saved))
            } else {
              dispatch(existing ? updateCaseSuccess(saved) : createCaseSuccess(saved))
            }
            onClose()
            if (liveEvent && !caseItem) navigate(`/cases/${saved.id}/workspace?view=event`)
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="modal-dialog__body">
          {formatControl}
          <label className="publication-company-field">
            Компания
            {user?.role === 'company' || existingPublication ? (
              <input className="input" readOnly title={company?.name} value={company?.name || ''} />
            ) : (
              <select
                className="select"
                name="company_id"
                title={company?.name}
                required
                disabled={busy || loadingCompanies}
                value={companyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
              >
                {!company && <option value="">Выберите компанию</option>}
                {companyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {companyUnavailable && (
              <span className="form-hint" role="status">
                {companyHint}
              </span>
            )}
          </label>
          <label>
            Название {name}
            <span className="form-hint">До 300 символов</span>
            <input
              className="input"
              required
              name="title"
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {!live &&
            (internship ? (
              <InternshipFields value={details} onChange={setDetails} />
            ) : olympiad ? (
              <OlympiadFields value={details} onChange={setDetails} />
            ) : kind === 'case' ? (
              <CaseFields value={details} onChange={setDetails} />
            ) : (
              <HackathonFields value={details} onChange={setDetails} />
            ))}
          <div className="responsive-grid">
            {!internship && (
              <label>
                Уровень сложности
                <select
                  className="select"
                  value={complexity}
                  onChange={(event) => setComplexity(event.target.value as CaseComplexity)}
                >
                  <option>Начальный</option>
                  <option>Средний</option>
                  <option>Высокий</option>
                </select>
              </label>
            )}
            {showDirection && (
              <label>
                {olympiad ? 'Предмет олимпиады' : 'Направление'}
                <select
                  className="select"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as ProjectDirection)}
                >
                  {live && <option value="">Не указано</option>}
                  {direction && !directionOptions.includes(direction) && (
                    <option>{direction}</option>
                  )}
                  {directionOptions.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {internship
                ? 'Окончание стажировки'
                : olympiad
                  ? 'Завершение последнего тура'
                  : 'Дедлайн защиты'}
              <input
                className="input"
                name="deadline"
                type="date"
                min={
                  caseItem?.deadlineDate && caseItem.deadlineDate < today
                    ? caseItem.deadlineDate
                    : today
                }
                max="2100-12-31"
                required
                defaultValue={caseItem?.deadlineDate || ''}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            <label>
              Формат проведения
              <select
                className="select"
                value={format}
                onChange={(e) => setFormat(e.target.value as WorkFormat)}
              >
                <option value="дистанционный">Дистанционный</option>
                <option value="очный">Очный</option>
                <option value="смешанный">Смешанный</option>
              </select>
            </label>
            <label>
              {participationFormat === 'team'
                ? 'Максимум команд'
                : participationFormat === 'both'
                  ? 'Лимит участников и команд'
                  : 'Количество мест'}
              {participationFormat === 'both' && (
                <span className="form-hint">
                  Один участник или одна команда занимают одно место.
                </span>
              )}
              <span className="form-hint">От 1 до 10 000</span>
              <input
                className="input"
                type="number"
                min="1"
                max="10000"
                required={live}
                value={limit}
                aria-invalid={
                  (!!limit && (Number(limit) < 1 || Number(limit) > 10000)) || undefined
                }
                onBlur={() => setLimit(normalizeNumber(limit))}
                onChange={(e) => setLimit(e.target.value)}
                placeholder={live ? 'Например, 30' : 'Без ограничения'}
              />
            </label>
          </div>
          {live && (
            <label>
              {liveEvent ? 'Срок регистрации' : 'Срок подачи заявок'}
              <input
                className="input"
                type="date"
                name="registrationDeadline"
                required={liveEvent}
                max={deadline || '2100-12-31'}
                defaultValue={initialRegistrationDay}
              />
            </label>
          )}
          {!internship && (
            <label>
              Формат участия
              <select
                className="select"
                value={participation}
                onChange={(e) => setParticipation(e.target.value as ParticipationFormat)}
              >
                <option value="both">Индивидуально и командами</option>
                <option value="team">Только командами</option>
                <option value="individual">Только индивидуально</option>
              </select>
            </label>
          )}
          {team && (
            <div className="responsive-grid">
              <label>
                Минимум участников команды
                <span className="form-hint">От 1 до 100</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={teamMinInput}
                  aria-invalid={(!!teamMinInput && (teamMin < 1 || teamMin > 100)) || undefined}
                  onChange={(e) => setTeamMin(e.target.value)}
                  onBlur={() => setTeamMin(normalizeNumber(teamMinInput))}
                />
              </label>
              <label>
                Максимум участников команды
                <span className="form-hint">От {Math.min(100, Math.max(2, teamMin))} до 100</span>
                <input
                  className="input"
                  type="number"
                  min={Math.max(2, teamMin)}
                  max="100"
                  required
                  value={teamMaxInput}
                  aria-invalid={
                    (!!teamMaxInput && (teamMax < Math.max(2, teamMin) || teamMax > 100)) ||
                    undefined
                  }
                  onChange={(e) => setTeamMax(e.target.value)}
                  onBlur={() => setTeamMax(normalizeNumber(teamMaxInput))}
                />
              </label>
            </div>
          )}
          {catalogError && (
            <p role="alert" className="form-error">
              {catalogError}
            </p>
          )}
          {live && !olympiad && (
            <details className="publication-competencies">
              <summary className="select">
                Предметная область и навыки
                {selectedSkills.length ? ` · выбрано ${selectedSkills.length}` : ''}
              </summary>
              <div className="publication-competencies__options">
                {serverSkills.length === 0 && <p>Нет доступных компетенций для выбора.</p>}
                {[...new Set([...serverSkills, ...selectedSkills])].map((name) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes(name)}
                      onChange={(e) =>
                        setSelectedSkills((current) =>
                          e.target.checked
                            ? [...current, name]
                            : current.filter((skill) => skill !== name),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
              </div>
            </details>
          )}
          {!live && (
            <label>
              {internship ? 'Требования к кандидату' : 'Предметная область и навыки'}
              <input
                className="input"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Через запятую"
              />
            </label>
          )}
          <label>
            Краткое описание
            <span className="form-hint">До 1 000 символов</span>
            <input
              className="input"
              required
              name="summary"
              maxLength={1000}
              value={short}
              onChange={(e) => setShort(e.target.value)}
            />
          </label>
          <label>
            {internship
              ? 'Задачи стажёра'
              : olympiad
                ? 'Предмет, описание заданий и туров'
                : 'Задача и требования к прототипу'}
            <span className="form-hint">До 30 000 символов</span>
            <textarea
              className="textarea"
              required
              name="description"
              maxLength={30000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {(olympiad || internship) && (
            <label>
              {olympiad ? 'Регламент и правила оценивания' : 'Условия, наставничество и оформление'}
              <textarea
                className="textarea"
                name="rules"
                required
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
            </label>
          )}
          <label>
            {internship ? 'Вознаграждение в месяц, ₽ (0 — без оплаты)' : 'Призовой фонд, ₽'}
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              max={maxPrize}
              aria-invalid={prize < 0 || prize > maxPrize || undefined}
              step="0.01"
              value={prizeInput}
              onChange={(e) => setPrize(e.target.value)}
              onBlur={() => setPrize(normalizeNumber(prizeInput))}
            />
            <span
              className={prize < 0 || prize > maxPrize ? 'publication-field-error' : 'form-hint'}
            >
              От 0 до {maxPrize.toLocaleString('ru-RU')} ₽
            </span>
          </label>
          <label className="publication-upload">
            {internship
              ? 'Программа стажировки — файл (необязательно)'
              : 'Техническое задание — файл'}
            <span className="form-hint">PDF, DOC, DOCX или TXT</span>
            <LocalizedFileInput
              className="input"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setSpec(e.target.files?.[0] || null)}
            />
            {!spec && caseItem?.specificationFile && (
              <span className="form-hint">Текущий файл: {caseItem.specificationFile.name}</span>
            )}
          </label>
          <label className="publication-upload">
            Обложка
            <LocalizedFileInput
              className="input"
              accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] || null)}
            />
          </label>
          {!olympiad && !internship && (
            <fieldset
              className="publication-criteria"
              disabled={!!caseItem && (!live || caseItem.status !== 'draft')}
            >
              <legend>Критерии оценки</legend>
              <p>Для каждого критерия укажите максимум баллов.</p>
              <div className="criteria-list">
                {criteria.map((c, i) => (
                  <div className="criteria-row" key={c.id}>
                    <label>
                      Название
                      <span className="form-hint">До 300 символов</span>
                      <input
                        className="input"
                        required
                        maxLength={300}
                        value={c.label}
                        onChange={(e) =>
                          setCriteria((cs) =>
                            cs.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)),
                          )
                        }
                      />
                    </label>
                    <label>
                      Баллы
                      <input
                        className="input"
                        type="number"
                        min="0.1"
                        step="0.1"
                        required
                        value={c.maxScore ?? 10}
                        onChange={(e) =>
                          setCriteria((cs) =>
                            cs.map((v, j) =>
                              j === i ? { ...v, weight: 1, maxScore: +e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="icon-delete"
                      type="button"
                      aria-label={`Удалить критерий ${i + 1}`}
                      onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setCriteria((cs) => [
                    ...cs,
                    { id: createId(), label: '', weight: 1, maxScore: 10 },
                  ])
                }
              >
                + Добавить критерий
              </button>
              {caseItem && <span role="note">После публикации критерии не меняются.</span>}
              <p>Максимум: {criteria.reduce((sum, c) => sum + (c.maxScore ?? 10), 0)} баллов</p>
            </fieldset>
          )}
          {olympiad && !live && (
            <fieldset disabled={!!caseItem && (!live || caseItem.status !== 'draft')}>
              <legend>Задачи и баллы</legend>
              <p>Участник получает баллы за каждую задачу. Итог — их сумма.</p>
              <div className="criteria-list">
                {tasks.map((task, i) => (
                  <div className="criteria-row" key={task.id}>
                    <label>
                      Задача
                      <input
                        className="input"
                        required
                        value={task.title}
                        onChange={(e) =>
                          setTasks((ts) =>
                            ts.map((t, j) => (j === i ? { ...t, title: e.target.value } : t)),
                          )
                        }
                      />
                    </label>
                    <label>
                      Максимум
                      <input
                        className="input"
                        type="number"
                        min="1"
                        required
                        value={task.maxScore}
                        onChange={(e) =>
                          setTasks((ts) =>
                            ts.map((t, j) =>
                              j === i ? { ...t, maxScore: Number(e.target.value) } : t,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-delete"
                      aria-label="Удалить задачу"
                      onClick={() => setTasks((ts) => ts.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() =>
                  setTasks((ts) => [...ts, { id: createId(), title: '', maxScore: 100 }])
                }
              >
                Добавить задачу
              </button>
              <p>Максимум: {tasks.reduce((sum, t) => sum + t.maxScore, 0)} баллов</p>
            </fieldset>
          )}

          {team && !olympiad && (
            <label className="nda-checkbox-field">
              <input type="checkbox" checked={nda} onChange={(e) => setNda(e.target.checked)} />{' '}
              Требуется NDA
            </label>
          )}
          {live && team && !olympiad && nda && canSaveNdaVersion && (
            <label>
              Текст соглашения о неразглашении
              <span className="form-hint">
                Для отправки на модерацию нужна действующая версия NDA.
              </span>
              <textarea
                className="textarea"
                required={!caseItem || !caseItem.isConfidential}
                name="ndaText"
                maxLength={12000}
                value={ndaText}
                placeholder={
                  caseItem?.isConfidential
                    ? 'Введите текст, чтобы сохранить новую версию'
                    : 'Введите условия, которые увидят участники'
                }
                onChange={(event) => setNdaText(event.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-dialog__footer">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          {live && !liveEvent && !caseItem && (
            <button
              className="btn btn-secondary"
              value="draft"
              disabled={busy || companyUnavailable}
            >
              Сохранить черновик
            </button>
          )}
          <button className="btn btn-primary" disabled={busy || companyUnavailable}>
            {busy
              ? 'Сохранение…'
              : caseItem
                ? 'Сохранить изменения'
                : liveEvent
                  ? 'Создать черновик и настроить план'
                  : 'Отправить на модерацию'}
          </button>
        </footer>
      </form>
    </>,
    `Размещение ${name}`,
  )
}
