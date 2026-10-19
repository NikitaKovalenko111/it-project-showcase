import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createCaseRequest } from '../../store/actions'
import { CaseComplexity, IPRightsType, ProjectDirection, RewardType, WorkFormat } from '../../types/models'
import { Building2, Plus, Sparkles, X } from 'lucide-react'

interface CreateCaseModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)
  const { companiesList } = useAppSelector((state) => state.companies)

  const defaultCompany = companiesList[0] || {
    id: 'comp_1',
    name: 'ООО «БашНефтеАвтоматика»',
    logo: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=100',
  }

  const [companyId, setCompanyId] = useState(currentUser?.companyProfile?.companyId || defaultCompany.id)
  const [title, setTitle] = useState('')
  const [direction, setDirection] = useState<ProjectDirection>('Backend')
  const [complexity, setComplexity] = useState<CaseComplexity>('Средний')
  const [participationFormat, setParticipationFormat] = useState<'individual' | 'team' | 'both'>('both')
  const [teamMin, setTeamMin] = useState(1)
  const [teamMax, setTeamMax] = useState(3)
  const [shortDescription, setShortDescription] = useState('')
  const [fullDescription, setFullDescription] = useState('')
  const [requiredCompetencies, setRequiredCompetencies] = useState('Python, PostgreSQL, Docker')
  const [recommendedTech, setRecommendedTech] = useState('FastAPI, React, Redis')
  const [workFormat, setWorkFormat] = useState<WorkFormat>('дистанционный')
  const [deadlineDate, setDeadlineDate] = useState('2026-12-31')
  const [duration, setDuration] = useState('2 месяца')
  const [rewardType, setRewardType] = useState<RewardType>('contest')
  const [prizeFund, setPrizeFund] = useState<number>(100000)
  const [rewardAmount, setRewardAmount] = useState<number>(50000)
  const [rewardDescription, setRewardDescription] = useState(
    'Призовой фонд 100 000 руб. + приглашение лучших участников на стажировку.'
  )
  const [isConfidential, setIsConfidential] = useState(false)
  const [ipRights, setIpRights] = useState<IPRightsType>('non_exclusive_license')

  if (!isOpen) return null

  const directionsList: ProjectDirection[] = [
    'Backend',
    'Frontend',
    'Fullstack',
    'Мобильная разработка',
    'Искусственный интеллект',
    'Машинное обучение',
    'Data Science',
    'Big Data',
    'DevOps',
    'Информационная безопасность',
    'Робототехника',
    'Компьютерное зрение',
    'Системное программирование',
    'Базы данных',
    'Тестирование',
    'UX/UI',
    'Бизнес-анализ',
    'Системный анализ',
    'Разработка игр',
    'AR/VR',
    'IoT',
    'Автоматизация',
    'Облачные технологии',
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const selectedCompany = companiesList.find((c) => c.id === companyId) || defaultCompany

    dispatch(
      createCaseRequest({
        title,
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        companyLogo: selectedCompany.logo,
        direction,
        complexity,
        participationFormat,
        teamSize: { min: Number(teamMin), max: Number(teamMax) },
        shortDescription,
        fullDescription: fullDescription || shortDescription,
        requiredCompetencies: requiredCompetencies.split(',').map((s) => s.trim()).filter(Boolean),
        recommendedTech: recommendedTech.split(',').map((s) => s.trim()).filter(Boolean),
        workFormat,
        deadlineDate,
        duration,
        resultRequirements: 'Рабочий репозиторий, документация, демонстрационный стенд.',
        evaluationOrder: 'Оценка экспертной комиссией компании по 10 критериям ТЗ.',
        rewardType,
        prizeFund: rewardType === 'contest' ? Number(prizeFund) : undefined,
        rewardAmount: rewardType === 'monetary' ? Number(rewardAmount) : undefined,
        rewardDescription,
        paymentStatus: rewardType === 'monetary' || rewardType === 'contest' ? 'pending' : 'not_provided',
        status: 'open',
        isConfidential,
        ipRights,
        isModerated: true,
      })
    )

    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 size={22} color="#1b5e91" />
            <div>
              <h3>Размещение нового ИТ-кейса</h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Формирование задачи для студентов УУНиТ (раздел 5.3 ТЗ)
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog__body">
            {/* Company selector */}
            <div className="form-group">
              <label>Компания-заказчик:*</label>
              <select disabled={currentUser?.role === 'company'} className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                {companiesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Case Title */}
            <div className="form-group">
              <label>Название проекта/кейса:*</label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Разработка сервиса анализа спутниковых снимков..."
                required
              />
            </div>

            {/* Direction & Complexity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>ИТ-направление (п. 5.6 ТЗ):*</label>
                <select
                  className="select"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as ProjectDirection)}
                >
                  {directionsList.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Уровень сложности:*</label>
                <select
                  className="select"
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value as CaseComplexity)}
                >
                  <option value="Начальный">Начальный (Junior / 1-2 курс)</option>
                  <option value="Средний">Средний (Middle / 3-4 курс)</option>
                  <option value="Высокий">Высокий (Senior / Магистратура)</option>
                </select>
              </div>
            </div>

            {/* Format & Team Size */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Формат участия:*</label>
                <select
                  className="select"
                  value={participationFormat}
                  onChange={(e) => setParticipationFormat(e.target.value as any)}
                >
                  <option value="both">Индивидуальный или командный</option>
                  <option value="team">Только командный</option>
                  <option value="individual">Только индивидуальный</option>
                </select>
              </div>

              <div className="form-group">
                <label>Формат работы:*</label>
                <select
                  className="select"
                  value={workFormat}
                  onChange={(e) => setWorkFormat(e.target.value as WorkFormat)}
                >
                  <option value="дистанционный">Дистанционный</option>
                  <option value="смешанный">Смешанный</option>
                  <option value="очный">Очный (в офисе / кампусе)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Срок выполнения / Дедлайн:*</label>
                <input
                  type="date"
                  className="input"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Short & Full Description */}
            <div className="form-group">
              <label>Краткое описание кейса:*</label>
              <textarea
                className="textarea"
                style={{ minHeight: '65px' }}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Краткое резюме задачи для карточки в каталоге..."
                required
              />
            </div>

            <div className="form-group">
              <label>Полное техническое задание (ТЗ):*</label>
              <textarea
                className="textarea"
                style={{ minHeight: '120px' }}
                value={fullDescription}
                onChange={(e) => setFullDescription(e.target.value)}
                placeholder="Подробные требования к архитектуре, функционалу, стеку и результатам..."
                required
              />
            </div>

            {/* Competencies & Tech */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Необходимые компетенции (через запятую):*</label>
                <input
                  type="text"
                  className="input"
                  value={requiredCompetencies}
                  onChange={(e) => setRequiredCompetencies(e.target.value)}
                  placeholder="Python, React, Docker..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Рекомендуемые технологии:*</label>
                <input
                  type="text"
                  className="input"
                  value={recommendedTech}
                  onChange={(e) => setRecommendedTech(e.target.value)}
                  placeholder="FastAPI, PostgreSQL..."
                  required
                />
              </div>
            </div>

            {/* Reward Classification (п. 5.4, 5.5 ТЗ) */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#0f2b48' }}>
                Форма поощрения и финансовые условия (п. 5.4, 5.5 ТЗ)
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Тип проекта:*</label>
                  <select
                    className="select"
                    value={rewardType}
                    onChange={(e) => setRewardType(e.target.value as RewardType)}
                  >
                    <option value="contest">Конкурсный проект (с призовым фондом)</option>
                    <option value="monetary">Проект с вознаграждением (оплата за результат)</option>
                    <option value="educational">Образовательный проект (без оплаты, портфолио)</option>
                    <option value="other">Иное поощрение (стажировка, оффер, техника)</option>
                  </select>
                </div>

                {rewardType === 'contest' && (
                  <div className="form-group">
                    <label>Призовой фонд (руб.):*</label>
                    <input
                      type="number"
                      className="input"
                      value={prizeFund}
                      onChange={(e) => setPrizeFund(Number(e.target.value))}
                      required
                    />
                  </div>
                )}

                {rewardType === 'monetary' && (
                  <div className="form-group">
                    <label>Сумма вознаграждения (руб.):*</label>
                    <input
                      type="number"
                      className="input"
                      value={rewardAmount}
                      onChange={(e) => setRewardAmount(Number(e.target.value))}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Описание формы поощрения:*</label>
                <input
                  type="text"
                  className="input"
                  value={rewardDescription}
                  onChange={(e) => setRewardDescription(e.target.value)}
                  placeholder="Опишите награды за призовые места или условия стажировки..."
                  required
                />
              </div>
            </div>

            {/* IP Rights & Confidentiality (п. 5.24, 5.25 ТЗ) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Права на результаты интеллектульной деятельности (п. 5.24):</label>
                <select
                  className="select"
                  value={ipRights}
                  onChange={(e) => setIpRights(e.target.value as IPRightsType)}
                >
                  <option value="non_exclusive_license">Неисключительная лицензия компании</option>
                  <option value="author">Права остаются у авторов (студентов)</option>
                  <option value="exclusive_company">Передача исключительного права компании</option>
                  <option value="open_source">Open Source (Открытая лицензия)</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={isConfidential}
                    onChange={(e) => setIsConfidential(e.target.checked)}
                  />
                  <span>Требует соглашения о конфиденциальности (NDA, п. 5.25)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Опубликовать кейс
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
