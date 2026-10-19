import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createApplicationRequest } from '../../store/actions'
import { CaseProject } from '../../types/models'
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

  const studentProfile = currentUser?.studentProfile
  const userTeams = teamsList.filter((t) => t.leaderId === currentUser?.id || t.members.some((m) => m.id === currentUser?.id))

  const [applicantType, setApplicantType] = useState<'individual' | 'team'>('individual')
  const [selectedTeamId, setSelectedTeamId] = useState(userTeams[0]?.id || '')
  const [coverLetter, setCoverLetter] = useState(
    'Здравствуйте! Наша команда ознакомилась с техническим заданием проекта. Имеем релевантный опыт в технологиях стека и готовы качественно реализовать поставленную задачу.'
  )
  const [resumeUrl, setResumeUrl] = useState(studentProfile?.portfolioUrl || 'https://uust.ru/resume/petrov.pdf')
  const [portfolioUrl, setPortfolioUrl] = useState(studentProfile?.portfolioUrl || 'https://petrov-dev.uust.space')
  const [githubUrl, setGithubUrl] = useState(studentProfile?.githubUrl || 'https://github.com/ivan-petrov-uust')
  const [ipRightsAgreed, setIpRightsAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ipRightsAgreed) {
      alert('Пожалуйста, подтвердите ознакомление с условиями прав на результаты интеллектуальной деятельности (РИД).')
      return
    }

    setIsSubmitting(true)

    const selectedTeam = userTeams.find((t) => t.id === selectedTeamId)

    dispatch(
      createApplicationRequest({
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
        coverLetter,
        resumeUrl,
        portfolioUrl,
        githubUrl,
        previousProjects: ['Предиктивный вибромониторинг', 'Smart PyTest Gen'],
      })
    )

    setTimeout(() => {
      setIsSubmitting(false)
      setSubmittedSuccess(true)
      setTimeout(() => {
        setSubmittedSuccess(false)
        onClose()
      }, 1500)
    }, 400)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div>
            <h3>Подача заявки на выполнение кейса</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Кейс: <strong>{caseItem.title}</strong> ({caseItem.companyName})
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {submittedSuccess ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CheckCircle2 size={48} color="#16805b" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px', color: '#16805b' }}>Заявка успешно отправлена!</h3>
            <p style={{ color: '#64748b', fontSize: '13px' }}>
              Представитель компании получил вашу заявку и рассмотрит её в ближайшее время.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-dialog__body">
              {/* Participation format */}
              <div className="form-group">
                <label>Формат участия в проекте:</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="applicantType"
                      checked={applicantType === 'individual'}
                      onChange={() => setApplicantType('individual')}
                    />
                    Индивидуально (Студент: {currentUser?.fullName})
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="applicantType"
                      checked={applicantType === 'team'}
                      onChange={() => setApplicantType('team')}
                    />
                    В составе команды
                  </label>
                </div>
              </div>

              {applicantType === 'team' && (
                <div className="form-group">
                  <label>Выберите проектную команду:</label>
                  <select
                    className="select"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    required
                  >
                    {userTeams.length > 0 ? (
                      userTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.members.length} участн.)
                        </option>
                      ))
                    ) : (
                      <option value="team_new">Команда NeuralKoders (3 участника)</option>
                    )}
                  </select>
                </div>
              )}

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Ссылка на резюме (CV):*</label>
                  <input
                    type="url"
                    className="input"
                    value={resumeUrl}
                    onChange={(e) => setResumeUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Ссылка на GitHub / GitLab:*</label>
                  <input
                    type="url"
                    className="input"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Ссылка на портфолио / личный сайт:</label>
                <input
                  type="url"
                  className="input"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                />
              </div>

              {/* IP Rights Notice (п. 5.24 ТЗ) */}
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
                    Права на результаты интеллектуальной деятельности (РИД, п. 5.24 ТЗ):
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
            </div>

            <div className="modal-dialog__footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || !ipRightsAgreed}>
                <Send size={15} />
                {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
