import { uploadFile } from '../../utils/files'
import { apiRuntime } from '../../api/runtime'
import { apiClient } from '../../api/client'
import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createApplicationSuccess, fetchCaseByIdRequest, fetchCasesRequest } from '../../store/actions'
import { CaseProject, StudentProfile } from '../../types/models'
import { CheckCircle2, FileText, Send, ShieldAlert, X } from 'lucide-react'

interface ApplicationModalProps {
  caseItem: CaseProject
  isOpen: boolean
  onClose: () => void
}

export const ApplicationModal: React.FC<ApplicationModalProps> = ({ caseItem, isOpen, onClose }) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)
  const { teamsList } = useAppSelector((state) => state.students)

  const registration=['olympiad','hackathon'].includes(caseItem.kind || '')
  const instantRegistration=registration&&apiRuntime.mode!=='live'
  const studentProfile = currentUser?.studentProfile
  const userTeams = teamsList.filter((t) => t.leaderId === currentUser?.id && (!t.caseId || t.caseId === caseItem.id))

  const teamFits=(size:number)=>size>=caseItem.teamSize.min&&size<=caseItem.teamSize.max
  const teamSizeText=caseItem.teamSize.min===caseItem.teamSize.max?String(caseItem.teamSize.min):`${caseItem.teamSize.min}–${caseItem.teamSize.max}`
  const [applicantType, setApplicantType] = useState<'individual' | 'team'>(caseItem.participationFormat === 'team' ? 'team' : 'individual')
  const [selectedTeamId, setSelectedTeamId] = useState(userTeams.find(team=>teamFits(team.members.length))?.id || '')
  const [coverLetter, setCoverLetter] = useState(
    'Здравствуйте! Наша команда ознакомилась с техническим заданием проекта. Имеем релевантный опыт в технологиях стека и готовы качественно реализовать поставленную задачу.'
  )
  const [savedResume,setSavedResume]=useState<StudentProfile['resume']>()
  useEffect(()=>{let active=true;if(isOpen&&!registration&&currentUser?.role==='student')apiClient.getResume().then(f=>{if(active)setSavedResume(f)}).catch(e=>{if(active)setSubmitError(e.message)});return()=>{active=false}},[isOpen,currentUser?.id,registration])
  const [resume, setResume] = useState<File | null>(null)
  const [githubUrl, setGithubUrl] = useState(studentProfile?.githubUrl || '')
  const [ipRightsAgreed, setIpRightsAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const selectedTeam = userTeams.find(t=>t.id===selectedTeamId)
  const invalidTeam = applicantType==='team' && (!selectedTeam || !teamFits(selectedTeam.members.length))

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
    if (!registration && !ipRightsAgreed) {
      setSubmitError('Подтвердите ознакомление с условиями использования результатов.')
      return
    }

    setIsSubmitting(true)

    setSubmitError('')
    try {
      if (invalidTeam) throw new Error(`Выберите команду подходящего размера: ${teamSizeText} чел.`)
      const resumeFile = registration ? undefined : resume ? await uploadFile(resume) : savedResume
      const application = await apiClient.createApplication({
        caseId: caseItem.id,
        caseTitle: caseItem.title,
        companyId: caseItem.companyId,
        applicantType,
        studentId: currentUser?.id || 'usr_student_1',
        studentName: currentUser?.fullName || 'Иван Петров',
        studentEmail: currentUser?.email || 'student@uust.ru',
        studentPhone: currentUser?.phone || '+7 (917) 000-00-00',
        studentCourse: studentProfile?.course || 3,
        studentInstitute: studentProfile?.institute || 'УУНиТ',
        studentAvatar: currentUser?.avatar,
        teamId: applicantType === 'team' ? selectedTeam?.id : undefined,
        teamName: applicantType === 'team' ? selectedTeam?.name : undefined,
        coverLetter: registration ? '' : coverLetter,
        resumeUrl: resumeFile?.url,
        resumeFileId: resumeFile?.file_id,
        portfolioUrl: registration ? undefined : studentProfile?.portfolioUrl,
        githubUrl: registration ? '' : githubUrl,
        previousProjects: [],
      })
      dispatch(createApplicationSuccess(application))
      dispatch(fetchCaseByIdRequest(caseItem.id))
      dispatch(fetchCasesRequest())
      setSubmittedSuccess(true)
    } catch (cause) { setSubmitError(cause instanceof Error ? cause.message : 'Не удалось отправить заявку') }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" role="dialog" aria-modal="true" aria-labelledby="application-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div>
            <h3 id="application-title">{instantRegistration ? 'Регистрация на мероприятие' : registration ? 'Заявка на участие' : 'Подача заявки на выполнение кейса'}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Кейс: <strong>{caseItem.title}</strong> ({caseItem.companyName})
            </p>
          </div>
          <button className="close-btn" aria-label="Закрыть" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {submittedSuccess ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CheckCircle2 size={48} color="#16805b" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px', color: '#16805b' }}>Заявка успешно отправлена!</h3>
            <p style={{ color: '#64748b', fontSize: '13px' }}>
              {instantRegistration ? 'Вы зарегистрированы. Работа доступна в активных проектах — одобрение организатора не требуется.' : 'Представитель компании получил заявку и рассмотрит её.'}
            </p>
            <button className="btn btn-primary" onClick={() => { setSubmittedSuccess(false); onClose() }}>Готово</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-dialog__body">
              {submitError && <p className="form-error application-error" role="alert">{submitError}</p>}
              {/* Participation format */}
              <div className="form-group">
                <label>Формат участия в проекте:</label>
                <div className="participation-options">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="applicantType"
                      disabled={caseItem.participationFormat === 'team'} checked={applicantType === 'individual'}
                      onChange={() => {setApplicantType('individual');setSubmitError('')}}
                    />
                    Индивидуально (Студент: {currentUser?.fullName})
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="applicantType"
                      disabled={caseItem.participationFormat === 'individual'} checked={applicantType === 'team'}
                      onChange={() => {setApplicantType('team');setSubmitError('')}}
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
                    value={selectedTeamId}
                    onChange={(e) => {setSelectedTeamId(e.target.value);setSubmitError('')}}
                    required
                  >
                    <option value="">Выберите команду</option>
                    {userTeams.length > 0 ? (
                      userTeams.map((team) => (
                        <option key={team.id} value={team.id} disabled={!teamFits(team.members.length)}>
                          {team.name} ({team.members.length} чел.){!teamFits(team.members.length) && ' · не подходит по размеру'}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>Сначала создайте команду</option>
                    )}
                  </select>
                  <p id="application-team-size" className="form-hint">Размер команды — {teamSizeText} чел.{!userTeams.some(team=>teamFits(team.members.length))&&' Подходящих команд пока нет.'}</p>
                </div>
              )}

              {!registration && <>
              {/* Cover Letter */}
              <div className="form-group">
                <label>Сопроводительный текст / Мотивационное письмо:*</label>
                <textarea
                  className="textarea"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Опишите, почему вы хотите принять участие и какой у вас опыт в данном стеке..."
                  required
                />
              </div>

              {/* Links */}
              <div className="application-links">
                <div className="form-group">
                  <label htmlFor="application-resume">Резюме (CV), до 2 МБ</label><input id="application-resume" type="file" className="input" accept=".pdf,.doc,.docx" onChange={e => setResume(e.target.files?.[0] || null)} />
                </div>
                <div className="form-group">
                  <label htmlFor="application-github">Ссылка на GitHub / GitLab:*</label>
                  <input
                    id="application-github" type="url"
                    className="input"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              {savedResume&&!resume&&<p className="form-hint">К заявке будет приложено резюме из профиля: {savedResume.name}. Можно выбрать другой файл.</p>}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldAlert size={16} color="#1b5e91" />
                  <strong style={{ fontSize: '12px', color: '#0f2b48' }}>
                    Права на результаты интеллектуальной деятельности (РИД):
                  </strong>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#475569' }}>
                  {getIpRightsText(caseItem.ipRights)} Передача исключительных прав не осуществляется автоматически фактом регистрации в Системе.
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={ipRightsAgreed}
                    onChange={(e) => setIpRightsAgreed(e.target.checked)}
                    required
                  />
                  Я ознакомлен и согласен с условиями прав на результаты интеллектуальной деятельности
                </label>
              </div>
              </>}
              {registration && <p>{instantRegistration?'После регистрации мероприятие появится в активных проектах.':'Мероприятие появится в активных проектах после одобрения заявки организатором.'}</p>}
            </div>

            <div className="modal-dialog__footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || invalidTeam || (!registration && !ipRightsAgreed)}>
                <Send size={15} />
                {isSubmitting ? 'Отправка...' : instantRegistration ? 'Зарегистрироваться' : 'Отправить заявку'}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  )
}
