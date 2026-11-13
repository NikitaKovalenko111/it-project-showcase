import { LocalizedFileInput } from '../LocalizedFileInput'
import { uploadFile } from '../../utils/files'
import { apiRuntime } from '../../api/runtime'
import { apiClient } from '../../api/client'
import { isOptionalWebUrl } from '../../utils/validation'
import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  createApplicationSuccess,
  fetchCaseByIdRequest,
  fetchCasesRequest,
} from '../../store/actions'
import { CaseProject, ProjectTeam, StudentProfile } from '../../types/models'
import { Link } from 'react-router-dom'
import { FileText, Send, ShieldAlert, X } from 'lucide-react'

interface ApplicationModalProps {
  caseItem: CaseProject
  isOpen: boolean
  onClose: () => void
  onSubmitted: (message: string) => void
}

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  caseItem,
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)
  const { teamsList } = useAppSelector((state) => state.students)

  const registration = ['olympiad', 'hackathon'].includes(caseItem.kind || '')
  const live = apiRuntime.mode === 'live'
  const [myTeams, setMyTeams] = useState<ProjectTeam[]>([])
  const [teamsLoading, setTeamsLoading] = useState(live)
  const [teamsError, setTeamsError] = useState('')
  useEffect(() => {
    if (!live || !isOpen || caseItem.participationFormat === 'individual') return
    let active = true
    setTeamsLoading(true)
    setTeamsError('')
    apiClient
      .getMyTeams()
      .then((teams) => {
        if (active) setMyTeams(teams)
      })
      .catch((error: Error) => {
        if (active) setTeamsError(error.message)
      })
      .finally(() => {
        if (active) setTeamsLoading(false)
      })
    return () => {
      active = false
    }
  }, [live, isOpen, caseItem.id, caseItem.participationFormat, currentUser?.id])
  const studentProfile = currentUser?.studentProfile
  const userTeams = (live ? myTeams : teamsList).filter(
    (t) => t.leaderId === currentUser?.id && (!t.caseId || t.caseId === caseItem.id),
  )

  const teamFits = (size: number) => size >= caseItem.teamSize.min && size <= caseItem.teamSize.max
  const teamSizeText =
    caseItem.teamSize.min === caseItem.teamSize.max
      ? String(caseItem.teamSize.min)
      : `${caseItem.teamSize.min}–${caseItem.teamSize.max}`
  const [applicantType, setApplicantType] = useState<'individual' | 'team'>(
    caseItem.participationFormat === 'team' ? 'team' : 'individual',
  )
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [savedResume, setSavedResume] = useState<StudentProfile['resume']>()
  const [attachSavedResume, setAttachSavedResume] = useState(false)
  useEffect(() => {
    let active = true
    if (isOpen && !registration && currentUser?.role === 'student')
      apiClient
        .getResume()
        .then((f) => {
          if (active) setSavedResume(f)
        })
        .catch((e) => {
          if (active) setSubmitError(e.message)
        })
    return () => {
      active = false
    }
  }, [isOpen, currentUser?.id, registration])
  const [resume, setResume] = useState<File | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [ipRightsAgreed, setIpRightsAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const eligibleTeams = userTeams.filter((team) => teamFits(team.members.length))
  const selectedTeam = eligibleTeams.find((team) => team.id === selectedTeamId) || eligibleTeams[0]
  const invalidTeam = applicantType === 'team' && (teamsLoading || !!teamsError || !selectedTeam)

  if (!isOpen) return null

  const getIpRightsText = (type: string) => {
    switch (type) {
      case 'author':
        return 'Исключительные права на результаты интеллектуальной деятельности остаются за студентом/автором.'
      case 'exclusive_company':
        return 'Исключительные права на РИД передаются компании-заказчику в соответствии с отдельным договором.'
      case 'non_exclusive_license':
        return 'Компания-заказчик получает простую (неисключительную) лицензию на использование результатов.'
      case 'open_source':
        return 'Результат публикуется под открытой лицензией (Open Source, MIT/Apache 2.0).'
      default:
        return 'Условия использования РИД регулируются индивидуальным соглашением.'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || currentUser?.role !== 'student') return
    if (!registration && !ipRightsAgreed) {
      setSubmitError('Подтвердите ознакомление с условиями использования результатов.')
      return
    }

    setIsSubmitting(true)

    setSubmitError('')
    try {
      if (invalidTeam) throw new Error(`Выберите команду подходящего размера: ${teamSizeText} чел.`)
      if (!registration && (!coverLetter.trim() || coverLetter.trim().length > 5000))
        throw new Error('Введите сопроводительное письмо до 5000 символов.')
      if (!registration && !isOptionalWebUrl(githubUrl))
        throw new Error('Укажите ссылку на репозиторий с http:// или https://.')
      if (resume && !registration && !/\.(pdf|docx?)$/i.test(resume.name))
        throw new Error('Выберите резюме в формате PDF, DOC или DOCX.')
      const resumeFile = registration
        ? undefined
        : resume
          ? await uploadFile(resume)
          : attachSavedResume
            ? savedResume
            : undefined
      const application = await apiClient.createApplication({
        caseId: caseItem.id,
        registration,
        caseTitle: caseItem.title,
        companyId: caseItem.companyId,
        applicantType,
        studentId: currentUser.id,
        studentName: currentUser.fullName,
        studentEmail: currentUser.email,
        studentPhone: currentUser.phone || '',
        studentCourse: studentProfile?.course || 3,
        studentInstitute: studentProfile?.institute || 'УУНиТ',
        studentAvatar: currentUser?.avatar,
        teamId: applicantType === 'team' ? selectedTeam?.id : undefined,
        teamName: applicantType === 'team' ? selectedTeam?.name : undefined,
        coverLetter: registration ? '' : coverLetter.trim(),
        resumeUrl: resumeFile?.url,
        resumeFileId: resumeFile?.file_id,
        portfolioUrl: registration ? undefined : studentProfile?.portfolioUrl,
        githubUrl: registration ? '' : githubUrl.trim(),
        previousProjects: [],
      })
      dispatch(createApplicationSuccess(application))
      dispatch(fetchCaseByIdRequest(caseItem.id))
      dispatch(fetchCasesRequest())
      onSubmitted(
        application.consentPending
          ? 'Заявка отправлена. Участники команды могут подтвердить условия в разделе «Заявки и избранное».'
          : registration
            ? 'Вы зарегистрированы. Мероприятие доступно в активных проектах.'
            : 'Заявка отправлена. Её статус доступен в разделе «Заявки и избранное».',
      )
    } catch (cause) {
      const error = cause as Error & { code?: string }
      const messages: Record<string, string> = {
        application_already_exists: 'Такая заявка уже есть. Проверьте раздел «Мои заявки».',
        application_access_denied:
          'Проверьте, что вы капитан команды, её состав подходит и выбранное резюме вам доступно.',
        case_not_accepting_applications:
          'Приём заявок закрыт или выбранный формат участия недоступен.',
        event_capacity_reached: 'Все места на мероприятии уже заняты.',
      }
      setSubmitError(
        (error.code && messages[error.code]) || error.message || 'Не удалось отправить заявку',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog modal-dialog--lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-dialog__header">
          <div>
            <h3 id="application-title">
              {registration ? 'Регистрация на мероприятие' : 'Подача заявки на выполнение кейса'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Кейс: <strong>{caseItem.title}</strong> ({caseItem.companyName})
            </p>
          </div>
          <button className="close-btn" aria-label="Закрыть" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog__body">
            {submitError && (
              <p className="form-error application-error" role="alert">
                {submitError}
              </p>
            )}
            {/* Participation format */}
            <div className="form-group">
              <label>Формат участия в проекте:</label>
              <div className="participation-options">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="radio"
                    name="applicantType"
                    disabled={caseItem.participationFormat === 'team'}
                    checked={applicantType === 'individual'}
                    onChange={() => {
                      setApplicantType('individual')
                      setSubmitError('')
                    }}
                  />
                  Индивидуально (Студент: {currentUser?.fullName})
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="radio"
                    name="applicantType"
                    disabled={caseItem.participationFormat === 'individual'}
                    checked={applicantType === 'team'}
                    onChange={() => {
                      setApplicantType('team')
                      setSubmitError('')
                    }}
                  />
                  В составе команды
                </label>
              </div>
            </div>

            {applicantType === 'team' && (
              <div className="form-group">
                <label htmlFor="application-team">Проектная команда</label>
                <select
                  id="application-team"
                  className="select"
                  aria-describedby="application-team-size"
                  value={selectedTeam?.id || ''}
                  disabled={teamsLoading || !!teamsError || !eligibleTeams.length}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value)
                    setSubmitError('')
                  }}
                  required
                >
                  <option value="">
                    {teamsLoading ? 'Загружаем команды…' : 'Выберите команду'}
                  </option>
                  {userTeams.map((team) => (
                    <option key={team.id} value={team.id} disabled={!teamFits(team.members.length)}>
                      {team.name} ({team.members.length} чел.)
                      {!teamFits(team.members.length) && ' · не подходит по размеру'}
                    </option>
                  ))}
                </select>
                <p id="application-team-size" className="form-hint">
                  Размер команды — {teamSizeText} чел.
                </p>
                {teamsError && <p role="alert">Не удалось загрузить команды. {teamsError}</p>}
                {!teamsLoading && !teamsError && !eligibleTeams.length && (
                  <p className="form-hint">
                    Заявку подаёт капитан команды подходящего размера.{' '}
                    <Link to="/teams" className="btn btn-secondary btn-sm" onClick={onClose}>
                      Открыть команды
                    </Link>
                  </p>
                )}
              </div>
            )}

            {!registration && (
              <>
                {/* Cover Letter */}
                <div className="form-group">
                  <label>Сопроводительный текст / Мотивационное письмо:*</label>
                  <textarea
                    className="textarea"
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    maxLength={5000}
                    placeholder="Опишите, почему вы хотите принять участие и какой у вас опыт в данном стеке..."
                    required
                  />
                </div>

                {/* Links */}
                <div className="application-links">
                  <div className="form-group">
                    <label htmlFor="application-resume">Резюме (CV)</label>
                    <LocalizedFileInput
                      id="application-resume"
                      className="input"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setResume(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="application-github">
                      Ссылка на GitHub / GitLab (необязательно)
                    </label>
                    <input
                      id="application-github"
                      type="url"
                      className="input"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                    />
                  </div>
                </div>

                {savedResume && !resume && (
                  <label className="form-hint">
                    <input
                      type="checkbox"
                      checked={attachSavedResume}
                      onChange={(event) => setAttachSavedResume(event.target.checked)}
                    />{' '}
                    Приложить резюме из профиля ({savedResume.name})
                  </label>
                )}
                {/* IP Rights Notice */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px',
                    marginTop: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                    }}
                  >
                    <ShieldAlert size={16} color="#1b5e91" />
                    <strong style={{ fontSize: '12px', color: '#0f2b48' }}>
                      Права на результаты интеллектуальной деятельности (РИД):
                    </strong>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#475569' }}>
                    {getIpRightsText(caseItem.ipRights)} Передача исключительных прав не
                    осуществляется автоматически фактом регистрации в Системе.
                  </p>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#1e293b',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ipRightsAgreed}
                      onChange={(e) => setIpRightsAgreed(e.target.checked)}
                      required
                    />
                    Я ознакомлен и согласен с условиями прав на результаты интеллектуальной
                    деятельности
                  </label>
                </div>
              </>
            )}
            {registration && (
              <p>
                {applicantType === 'team'
                  ? 'Мероприятие появится в активных проектах, когда все участники подтвердят условия.'
                  : 'После регистрации мероприятие появится в активных проектах.'}
              </p>
            )}
          </div>

          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || invalidTeam || (!registration && !ipRightsAgreed)}
            >
              <Send size={15} />
              {isSubmitting
                ? 'Отправка...'
                : registration
                  ? 'Зарегистрироваться'
                  : 'Отправить заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
