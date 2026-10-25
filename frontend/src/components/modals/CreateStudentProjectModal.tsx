import { apiClient } from '../../api/client'
import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createStudentProjectSuccess } from '../../store/actions'
import { ProjectDirection, StudentProjectBadge, StudentProjectCategory } from '../../types/models'
import { FolderGit2, Plus, X } from 'lucide-react'

interface CreateStudentProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmitted?: () => void
}

export const CreateStudentProjectModal: React.FC<CreateStudentProjectModalProps> = ({ isOpen, onClose, onSubmitted }) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<StudentProjectCategory>('pet-проект')
  const [direction, setDirection] = useState<ProjectDirection>('Frontend')
  const [shortDescription, setShortDescription] = useState('')
  const [fullDescription, setFullDescription] = useState('')
  const [problemSolved, setProblemSolved] = useState('')
  const [technologies, setTechnologies] = useState('React, TypeScript, Vite')
  const [coverImage, setCoverImage] = useState(
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80'
  )
  const [githubUrl, setGithubUrl] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [badges, setBadges] = useState<StudentProjectBadge[]>(['seeking_team', 'open_for_internship'])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const availableBadges: { id: StudentProjectBadge; label: string }[] = [
    { id: 'seeking_company', label: 'Ищу компанию / партнёра' },
    { id: 'seeking_team', label: 'Ищу команду' },
    { id: 'seeking_mentor', label: 'Ищу наставника' },
    { id: 'seeking_investor', label: 'Ищу инвестора' },
    { id: 'open_for_internship', label: 'Открыт к предложениям о стажировке' },
    { id: 'open_for_job', label: 'Открыт к предложениям о работе' },
  ]

  const toggleBadge = (id: StudentProjectBadge) => {
    if (badges.includes(id)) {
      setBadges(badges.filter((b) => b !== id))
    } else {
      setBadges([...badges, id])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')
    setSaving(true)
    try {
      const created = await apiClient.createStudentProject({
        title,
        coverImage,
        authorId: currentUser?.id || 'usr_student_1',
        authorName: currentUser?.fullName || 'Иван Петров',
        category,
        direction,
        shortDescription,
        fullDescription: fullDescription || shortDescription,
        problemSolved,
        technologies: technologies.split(',').map((s) => s.trim()).filter(Boolean),
        status: 'в разработке',
        githubUrl: githubUrl || undefined,
        productUrl: productUrl || undefined,
        screenshots: [coverImage],
        badges,
      })
      dispatch(createStudentProjectSuccess(created))
      onSubmitted?.()
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось отправить проект') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderGit2 size={22} color="#1b5e91" />
            <div>
              <h3>Публикация студенческого проекта</h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Проект появится в открытой витрине после одобрения куратором
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-dialog__body">
            <div className="form-group">
              <label>Название проекта:*</label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Платформа взаимного менторинга PeerStudy"
                required
              />
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Категория проекта:*</label>
                <select
                  className="select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as StudentProjectCategory)}
                >
                  <option value="pet-проект">Pet-проект</option>
                  <option value="учебный">Учебный проект</option>
                  <option value="курсовой">Курсовой проект</option>
                  <option value="ВКР">Выпускная квалификационная работа (ВКР)</option>
                  <option value="хакатон">Проект с хакатона</option>
                  <option value="стартап">Стартап</option>
                  <option value="НИР">Научно-исследовательский проект (НИР)</option>
                  <option value="open_source">Open-source разработка</option>
                </select>
              </div>

              <div className="form-group">
                <label>ИТ-направление:*</label>
                <select
                  className="select"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as ProjectDirection)}
                >
                  <option value="Frontend">Frontend</option>
                  <option value="Backend">Backend</option>
                  <option value="Fullstack">Fullstack</option>
                  <option value="Мобильная разработка">Мобильная разработка</option>
                  <option value="Искусственный интеллект">Искусственный интеллект</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Информационная безопасность">Информационная безопасность</option>
                  <option value="IoT">IoT</option>
                  <option value="Робототехника">Робототехника</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Краткое описание:*</label>
              <textarea
                className="textarea"
                style={{ minHeight: '60px' }}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Краткая суть разработки в 2-3 предложениях..."
                required
              />
            </div>

            <div className="form-group">
              <label>Решаемая проблема:*</label>
              <input
                type="text"
                className="input"
                value={problemSolved}
                onChange={(e) => setProblemSolved(e.target.value)}
                placeholder="Какую конкретную проблему или потребность решает ваш продукт..."
                required
              />
            </div>

            <div className="form-group">
              <label>Используемые технологии (через запятую):*</label>
              <input
                type="text"
                className="input"
                value={technologies}
                onChange={(e) => setTechnologies(e.target.value)}
                placeholder="React, TypeScript, Docker..."
                required
              />
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Ссылка на репозиторий GitHub/GitLab:</label>
                <input
                  type="url"
                  className="input"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                />
              </div>

              <div className="form-group">
                <label>Ссылка на работающий сервис / демо:</label>
                <input
                  type="url"
                  className="input"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://my-project.ru"
                />
              </div>
            </div>

            {/* Badges selection */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Дополнительные отметки для работодателей и команд:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {availableBadges.map(({ id, label }) => {
                  const active = badges.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleBadge(id)}
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ borderRadius: '8px' }}
                    >
                      {active ? '✓ ' : '+ '}
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Plus size={16} /> {saving ? 'Отправка…' : 'Отправить на рассмотрение'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
