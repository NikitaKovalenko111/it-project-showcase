import { LocalizedFileInput } from '../LocalizedFileInput'
import { Modal } from '../Modal'
import { axiosInstance } from '../../api/http'
import { localDate } from '../../utils/date'
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

export const CreateCaseModal: React.FC<{
  caseItem?: CaseProject
  isOpen: boolean
  onClose: () => void
}> = ({ caseItem, isOpen, onClose }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [opportunity, setOpportunity] = useState<OpportunityKind>()
  const [opportunityNotice, setOpportunityNotice] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const user = useAppSelector((s) => s.auth.currentUser),
    companies = useAppSelector((s) => s.companies.companiesList)
  const [kind, setKind] = useState<CaseKind>('case'),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [short, setShort] = useState('')
  const [companyId, setCompanyId] = useState(''),
    [direction, setDirection] = useState<ProjectDirection | ''>(live ? '' : 'Frontend'),
    [deadline, setDeadline] = useState('')
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
    [prize, setPrize] = useState(0)
  const [participation, setParticipation] = useState<ParticipationFormat>('team')
  const [teamMin, setTeamMin] = useState(2),
    [teamMax, setTeamMax] = useState(5),
    [limit, setLimit] = useState(''),
    [nda, setNda] = useState(false)
  const [criteria, setCriteria] = useState<
    { id: string; label: string; weight: number; maxScore?: number }[]
  >([{ id: crypto.randomUUID(), label: 'Качество решения', weight: 1, maxScore: 10 }])
  const [tasks, setTasks] = useState<{ id: string; title: string; maxScore: number }[]>(
    caseItem?.olympiadTasks || [{ id: crypto.randomUUID(), title: 'Задача A', maxScore: 100 }],
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
    setOpportunity(undefined)
    setOpportunityNotice('')
    setSpec(null)
    setCover(null)
    setCompanyId(caseItem?.companyId || user?.companyProfile?.companyId || companies[0]?.id || '')
    setKind(caseItem?.kind || 'case')
    setSelectedSkills(caseItem?.requiredCompetencies || [])
    if (caseItem) {
      setTasks(caseItem.olympiadTasks || [])
      setKind(caseItem.kind || 'case')
      setTitle(caseItem.title)
      setDescription(caseItem.fullDescription)
      setShort(caseItem.shortDescription)
      setDirection(caseItem.direction)
      setDeadline(caseItem.deadlineDate)
      setRegistrationDeadline(caseItem.applicationDeadline?.slice(0, 10) || '')
      setFormat(caseItem.workFormat)
      setSkills(caseItem.requiredCompetencies.join(', '))
      setRules(caseItem.olympiadRules || caseItem.internshipConditions || '')
      setPrize(caseItem.prizeFund || caseItem.rewardAmount || 0)
      setParticipation(caseItem.participationFormat)
      setTeamMin(caseItem.teamSize.min)
      setTeamMax(caseItem.teamSize.max)
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
      className="modal-dialog--lg publication-dialog"
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
        disabled={!!caseItem}
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
        {(!live || user?.role === 'company') && <option value="internship">Стажировка</option>}
        {live && user?.role === 'company' && <option value="practice">Практика</option>}
      </select>
    </label>
  )
  if (opportunityNotice)
    return dialog(
      <>
        <div className="modal-dialog__body">
          <p role="status">{opportunityNotice}</p>
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
        companies={companies.filter((company) => company.id === companyId)}
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
        onInvalid={(event) => {
          const field = event.target as HTMLInputElement
          const label = field.labels?.[0]?.firstChild?.textContent?.trim()
          setError(label ? `Проверьте поле «${label}».` : 'Проверьте обязательные поля.')
        }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          setBusy(true)
          setError('')
          try {
            const deadline = String(new FormData(e.currentTarget).get('deadline') || '')
            const submit =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'draft'
            const company = companies.find((c) => c.id === companyId)
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
            if (liveEvent && (!registrationDeadline || registrationDeadline > deadline))
              throw new Error('Укажите срок регистрации не позднее окончания мероприятия.')
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
              complexity: caseItem?.complexity || 'Средний',
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
                liveEvent && registrationDeadline
                  ? `${registrationDeadline}T23:59:59Z`
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
              coverUrl: file?.url || caseItem?.coverUrl,
              coverFileId: file?.file_id || caseItem?.coverFileId,
            }
            const saved = caseItem
              ? await apiClient.updateCase({
                  ...caseItem,
                  ...payload,
                  status: caseItem.status,
                  isModerated: caseItem.isModerated,
                  moderationStatus: caseItem.moderationStatus,
                })
              : await apiClient.createCase(payload, !liveEvent && submit)
            dispatch(caseItem ? updateCaseSuccess(saved) : createCaseSuccess(saved))
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
          <label>
            Компания
            <select
              className="select"
              required
              disabled={user?.role === 'company'}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Название {name}
            <input
              className="input"
              required
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
                value={deadline}
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
              {participationFormat === 'team' ? 'Максимум команд' : 'Количество мест'}
              <input
                className="input"
                type="number"
                min="1"
                max="10000"
                required={live}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder={live ? 'Например, 30' : 'Без ограничения'}
              />
            </label>
          </div>
          {liveEvent && (
            <label>
              Срок регистрации
              <input
                className="input"
                type="date"
                required
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
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
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={teamMin}
                  onChange={(e) => setTeamMin(+e.target.value)}
                />
              </label>
              <label>
                Максимум участников команды
                <input
                  className="input"
                  type="number"
                  min={Math.max(2, teamMin)}
                  max="100"
                  required
                  value={teamMax}
                  onChange={(e) => setTeamMax(+e.target.value)}
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
            <fieldset className="publication-competencies">
              <legend>Предметная область и навыки</legend>
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
            </fieldset>
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
            <input
              className="input"
              required
              maxLength={500}
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
            <textarea
              className="textarea"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {(olympiad || internship) && (
            <label>
              {olympiad ? 'Регламент и правила оценивания' : 'Условия, наставничество и оформление'}
              <textarea
                className="textarea"
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
              required
              value={prize}
              onChange={(e) => setPrize(+e.target.value)}
            />
          </label>
          <label className="publication-upload">
            {internship
              ? 'Программа стажировки — файл (необязательно)'
              : 'Техническое задание — файл'}
            <span className="form-hint">PDF, DOC, DOCX или TXT, до 2 МБ</span>
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
                      <input
                        className="input"
                        required
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
                    { id: crypto.randomUUID(), label: '', weight: 1, maxScore: 10 },
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
                  setTasks((ts) => [...ts, { id: crypto.randomUUID(), title: '', maxScore: 100 }])
                }
              >
                Добавить задачу
              </button>
              <p>Максимум: {tasks.reduce((sum, t) => sum + t.maxScore, 0)} баллов</p>
            </fieldset>
          )}

          {team && !olympiad && (
            <label>
              <input type="checkbox" checked={nda} onChange={(e) => setNda(e.target.checked)} />{' '}
              Требуется NDA
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
            <button className="btn btn-secondary" value="draft" disabled={busy}>
              Сохранить черновик
            </button>
          )}
          <button className="btn btn-primary" disabled={busy}>
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
