import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { updateUserProfileRequest } from '../store/actions'
import { InviteStudentModal } from '../components/modals/InviteStudentModal'
import { participatesInCase } from '../utils/access'
import { mockServer } from '../api/mockServer'
import {
  Award,
  Bookmark,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FolderGit2,
  Github,
  Globe,
  GraduationCap,
  Layers,
  Mail,
  Phone,
  Save,
  Send,
  ShieldCheck,
  Star,
  Trophy,
  User,
  Users,
} from 'lucide-react'

// Seed URLs are examples, not published student contacts.
const demoProfileLinks = new Set([
  'https://github.com/almaz-magasumov',
  'https://uust.ru/portfolio/257576',
  'https://github.com/masha-vasilieva',
  'https://behance.net/masha-design',
  'https://github.com/artur-karimov',
])
const editableProfileLink = (url?: string) => url && !demoProfileLinks.has(url) ? url : ''

export const StudentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const { currentUser, allUsers, loading, error } = useAppSelector((state) => state.auth)
  const { casesList } = useAppSelector((state) => state.cases)
  const { projectsList } = useAppSelector((state) => state.studentProjects)

  const { studentsList, teamsList } = useAppSelector((state) => state.students)

  // Resolve only the requested student; never substitute another person's profile.
  const targetId = id === 'me' ? currentUser?.id : id
  const targetUser = [...(currentUser ? [currentUser] : []), ...allUsers, ...studentsList].find((u) => u.id === targetId)
  const isOwnProfile = currentUser?.id === targetUser?.id
  const student = targetUser?.studentProfile

  const [isEditing, setIsEditing] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  // Edit fields
  const [bio, setBio] = useState(student?.bio || '')
  const [skills, setSkills] = useState(student?.skills.join(', ') || '')
  const [techStack, setTechStack] = useState(student?.techStack.join(', ') || '')
  const [githubUrl, setGithubUrl] = useState(editableProfileLink(student?.githubUrl))
  const [portfolioUrl, setPortfolioUrl] = useState(editableProfileLink(student?.portfolioUrl))

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUser) return

    const updatedUser = {
      ...targetUser,
      studentProfile: {
        ...targetUser.studentProfile!,
        bio,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        techStack: techStack.split(',').map((s) => s.trim()).filter(Boolean),
        githubUrl: githubUrl.trim(),
        portfolioUrl: portfolioUrl.trim(),
      },
    }

    dispatch(updateUserProfileRequest(updatedUser))
  }

  useEffect(() => {
    setIsEditing(false)
    setBio(student?.bio || '')
    setSkills(student?.skills.join(', ') || '')
    setTechStack(student?.techStack.join(', ') || '')
    setGithubUrl(editableProfileLink(student?.githubUrl))
    setPortfolioUrl(editableProfileLink(student?.portfolioUrl))
  }, [targetId, student])

  if (!targetUser?.studentProfile) return <div className="card" style={{ padding: 24 }}>Профиль студента не найден или загружается.</div>

  // Verified cases where student participated and received review
  const verifiedCases = casesList.filter(
    (c) => c.status === 'completed' && participatesInCase(targetUser.id, c, teamsList)
  )

  // Student's own projects
  const ownProjects = projectsList.filter((p) => p.authorId === targetUser.id)

  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {/* Profile Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #091b2e 0%, #17395c 100%)',
          color: '#ffffff',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '24px',
        }}
      >
        <div className="profile-banner-body" style={{ padding: '32px 36px', display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
          <img
            src={
              targetUser.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
            }
            alt={targetUser.fullName}
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '4px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
          />

          <div style={{ flex: 1, minWidth: 'min(280px, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  background: 'rgba(38, 158, 184, 0.25)',
                  border: '1px solid #38a5e1',
                  color: '#7ce7fb',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Подтверждённое портфолио
              </span>
              <span style={{ fontSize: '12px', color: '#93c5fd' }}>Курс {student?.course || 3}</span>
            </div>

            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
              {targetUser.fullName}
            </h1>

            <div style={{ fontSize: '13px', color: '#b0c6dd', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>{student?.institute || 'Институт информатики, математики и робототехники'}</div>
              <div>
                Направление: <strong>{student?.fieldOfStudy || '09.03.04 Программная инженерия'}</strong> (Группа {student?.group || 'ПИ-301Б'})
              </div>
            </div>
          </div>

          {/* Rating Widget */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '16px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#f59e0b', marginBottom: '2px' }}>
              <Star size={18} fill="#f59e0b" />
              <strong style={{ fontSize: '24px', color: '#fff' }}>{student?.rating ?? 0}</strong>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Рейтинг студента</span>
            <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '4px' }}>
              {student?.winsCount ?? 0} победы в конкурсах
            </div>
          </div>

          {/* Actions */}
          <div>
            {isOwnProfile ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 size={14} /> {isEditing ? 'Отменить редактирование' : 'Редактировать профиль'}
              </button>
            ) : currentUser?.role === 'company' ? (
              <button className="btn btn-primary btn-sm" onClick={() => setInviteModalOpen(true)}>
                <Send size={14} /> Пригласить в кейс / на стажировку
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Edit Form if editing */}
      {isEditing && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>Редактирование сведений портфолио</h3>
          </div>
          <form onSubmit={handleSaveProfile}>
            <div className="card__body">
              <div className="form-group">
                <label>О себе (краткое описание):</label>
                <textarea
                  className="textarea"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={{ minHeight: '70px' }}
                />
              </div>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Компетенции (через запятую):</label>
                  <input
                    type="text"
                    className="input"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Стек технологий (через запятую):</label>
                  <input
                    type="text"
                    className="input"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                  />
                </div>
              </div>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Ссылка на GitHub:</label>
                  <input
                    type="url"
                    className="input"
                    pattern="https?://.*" value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Ссылка на портфолио:</label>
                  <input
                    type="url"
                    className="input"
                    pattern="https?://.*" value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="card__footer">
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                <Save size={14} /> {loading ? 'Сохранение…' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid: Left - Verified Projects & Own Projects, Right - Competencies & Contacts */}
      <div className="responsive-detail-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column */}
        <div>
          {/* SECTION 1: VERIFIED CASES BY COMPANIES */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#16805b" />
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Выполненные кейсы компаний
                </h3>
              </div>
              <span className="badge badge-verified">
                Подтверждённых кейсов: {verifiedCases.length}
              </span>
            </div>

            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {verifiedCases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                  Пока нет подтвержденных кейсов
                </div>
              ) : (
                verifiedCases.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '18px 20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={c.companyLogo}
                          alt=""
                          style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{c.companyName}</strong>
                      </div>

                      <span
                        style={{
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={13} color="#10b981" /> Отметка: Проект подтверждён компанией
                      </span>
                    </div>

                    <Link to={`/cases/${c.id}`}>
                      <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#0f2b48' }}>{c.title}</h4>
                    </Link>

                    <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                      {c.shortDescription}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                      <span>Направление: {c.direction}</span>
                      <Link to={`/cases/${c.id}/workspace`} className="btn btn-secondary btn-sm">
                        Смотреть результаты решения →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 2: STUDENT'S OWN PROJECTS */}
          <div className="card">
            <div className="card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderGit2 size={20} color="#1b5e91" />
                <h3 style={{ margin: 0, fontSize: '16px' }}>Собственные проекты студента ({ownProjects.length})</h3>
              </div>
            </div>

            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {ownProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                  Нет опубликованных студенческих проектов
                </div>
              ) : (
                ownProjects.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      padding: '14px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <img
                      src={p.coverImage}
                      alt=""
                      style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span className="badge badge-direction" style={{ fontSize: '10px', marginBottom: '4px' }}>
                        {p.category}
                      </span>
                      <Link to={`/student-projects/${p.id}`}>
                        <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#0f2b48' }}>{p.title}</h4>
                      </Link>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{p.shortDescription}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Bio, Tech Stack, Competencies, External Links */}
        <div>
          {/* Bio Card */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>О себе и интересы</h3>
            </div>
            <div className="card__body">
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                {student?.bio || 'Студент кафедры программной инженерии.'}
              </p>

              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Профессиональные интересы:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(student?.interests || ['Веб-разработка', 'ML', 'Архитектура']).map((int) => (
                    <span
                      key={int}
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {int}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Competencies & Tech Stack */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>Компетенции и стек</h3>
            </div>
            <div className="card__body">
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Ключевые компетенции:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(student?.skills || ['React', 'Python', 'FastAPI']).map((s) => (
                    <span
                      key={s}
                      style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Технологический стек:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(student?.techStack || ['React', 'TypeScript', 'Docker']).map((ts) => (
                    <span
                      key={ts}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#0f2b48',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      {ts}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* External Links */}
          <div className="card">
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>Контакты и профили</h3>
            </div>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {editableProfileLink(student?.githubUrl) && /^https?:\/\//i.test(student.githubUrl) && (
                <a
                  href={student.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Github size={15} /> GitHub профиль
                </a>
              )}

              {editableProfileLink(student?.portfolioUrl) && /^https?:\/\//i.test(student.portfolioUrl) && (
                <a
                  href={student.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Globe size={15} /> Внешнее веб-портфолио
                </a>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                <Mail size={14} color="#64748b" /> {targetUser.email}
              </div>

              {targetUser.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <Phone size={14} color="#64748b" /> {targetUser.phone}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for inviting student */}
      <InviteStudentModal
        student={targetUser}
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />
    </div>
  )
}
