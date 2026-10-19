import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchStudentsRequest, fetchTeamsRequest } from '../store/actions'
import { InviteStudentModal } from '../components/modals/InviteStudentModal'
import { CreateTeamModal } from '../components/modals/CreateTeamModal'
import { User } from '../types/models'
import {
  Award,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react'

export const StudentsSearchPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { studentsList, teamsList, loading } = useAppSelector((state) => state.students)
  const { casesList } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [search, setSearch] = useState('')
  const [institute, setInstitute] = useState('all')
  const [course, setCourse] = useState('all')
  const [skill, setSkill] = useState('')
  const [minRating, setMinRating] = useState(0)

  const [selectedStudentForInvite, setSelectedStudentForInvite] = useState<User | null>(null)
  const [teamModalOpen, setTeamModalOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchStudentsRequest())
    dispatch(fetchTeamsRequest())
  }, [dispatch])

  // Filtering
  const filteredStudents = studentsList.filter((s) => {
    const prof = s.studentProfile
    if (!prof) return false

    if (search) {
      const q = search.trim().toLowerCase()
      const match =
        s.fullName.toLowerCase().includes(q) ||
        prof.group.toLowerCase().includes(q) ||
        prof.fieldOfStudy.toLowerCase().includes(q) ||
        prof.skills.some((sk) => sk.toLowerCase().includes(q)) ||
        prof.techStack.some((ts) => ts.toLowerCase().includes(q))
      if (!match) return false
    }

    if (institute !== 'all' && prof.institute !== institute) return false
    if (course !== 'all' && prof.course !== Number(course)) return false
    if (skill && ![...prof.skills, ...prof.techStack].some((sk) => sk.toLowerCase().includes(skill.trim().toLowerCase()))) return false
    if (minRating > 0 && prof.rating < minRating) return false

    return true
  })

  const canInvite = currentUser?.role === 'company'
  const institutes = [...new Set(studentsList.map((student) => student.studentProfile?.institute).filter(Boolean))]

  // Recommended students algorithm (п. 5.18 ТЗ) based on matching company cases technologies
  const companyTech = new Set(casesList.filter((project) => project.companyId === currentUser?.companyProfile?.companyId).flatMap((project) => project.requiredCompetencies.map((tech) => tech.toLowerCase())))
  const recommendedCandidates = filteredStudents.filter((student) => [...(student.studentProfile?.skills || []), ...(student.studentProfile?.techStack || [])].some((tech) => companyTech.has(tech.toLowerCase()))).slice(0, 3)

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__content">
          <h1>{currentUser?.role === 'curator' ? 'Студенты и группы' : 'Поиск студентов и проектных команд'}</h1>
          <p>
            База перспективных студентов, разработчиков и готовых кросс-функциональных команд УУНиТ.
            {canInvite ? 'Подбирайте исполнителей по компетенциям и приглашайте в свои кейсы.' : 'Просматривайте группы, компетенции, рейтинг и портфолио студентов.'}
          </p>
        </div>
        {currentUser?.role === 'student' && <div className="page-header__actions">
          <button className="btn btn-secondary" onClick={() => setTeamModalOpen(true)}>
            <Plus size={16} /> Создать проектную команду
          </button>
        </div>}
      </div>

      {/* Recommended Section (п. 5.18 ТЗ) */}
      {canInvite && recommendedCandidates.length > 0 && <div
        style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Sparkles size={18} color="#2563eb" />
          <h3 style={{ margin: 0, fontSize: '15px', color: '#1e3a8a' }}>
            Рекомендованные кандидаты под требования ИТ-кейсов (п. 5.18 ТЗ)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {recommendedCandidates.map((cand) => (
            <div
              key={cand.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={cand.avatar}
                  alt=""
                  style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>{cand.fullName}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {cand.studentProfile?.fieldOfStudy.split(' ')[1] || 'ИТ-направление'} • {cand.studentProfile?.course} курс
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#d97706', marginTop: '2px' }}>
                    <Star size={12} fill="#d97706" /> Рейтинг: <strong>{cand.studentProfile?.rating}</strong>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedStudentForInvite(cand)}
                style={{ flexShrink: 0 }}
              >
                <Send size={13} /> Пригласить
              </button>
            </div>
          ))}
        </div>
      </div>}

      {/* Filter Bar */}
      <div className="uust-container">
        <div className="uust-box">
          <div className="uust-filter-row">
            <label className="catalog-filter">ФИО, группа или компетенция
              <input className="uust-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ФИО, группа, React, Python…" />
            </label>
          </div>
          <div className="uust-filter-row">
            <label className="catalog-filter">Институт<select className="uust-select" value={institute} onChange={(e) => setInstitute(e.target.value)}>
              <option value="all">Все институты</option>
              {institutes.map((name) => <option key={name}>{name}</option>)}
            </select></label>
            <label className="catalog-filter">Курс<select className="uust-select" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="all">Любой курс</option>{[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>{year} курс</option>)}
            </select></label>
            <label className="catalog-filter">Навык или технология<input className="uust-input" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Например, Docker" /></label>
            <label className="catalog-filter">Рейтинг<select className="uust-select" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              <option value={0}>Любой рейтинг</option><option value={85}>От 85 баллов</option><option value={90}>От 90 баллов</option>
            </select></label>
          </div>
          <div className="uust-pills-row"><span aria-live="polite">Найдено студентов: {filteredStudents.length}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setInstitute('all'); setCourse('all'); setSkill(''); setMinRating(0) }}>Сбросить фильтры</button>
          </div>
        </div>
      </div>
      {loading && <p role="status">Загрузка студентов…</p>}
      {!loading && filteredStudents.length === 0 && <p>Студенты по заданным фильтрам не найдены.</p>}

      {/* Students List Grid */}
      <div className="case-grid">
        {filteredStudents.map((stud) => {
          const prof = stud.studentProfile!

          return (
            <div key={stud.id} className="card card-hover">
              <div className="card__body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                  <img
                    src={stud.avatar}
                    alt=""
                    style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/profile/${stud.id}`}>
                      <h3 style={{ margin: '0 0 2px', fontSize: '15px', color: '#0f2b48' }}>{stud.fullName}</h3>
                    </Link>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Группа {prof.group} • {prof.course} курс ({prof.fieldOfStudy})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span className="badge badge-complexity-medium" style={{ fontSize: '10px' }}>
                        ★ {prof.rating} балла
                      </span>
                      {prof.winsCount > 0 && (
                        <span className="badge badge-reward-contest" style={{ fontSize: '10px' }}>
                          <Trophy size={11} /> {prof.winsCount} победы
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                  {prof.bio}
                </p>

                {/* Skills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {prof.skills.map((sk) => (
                    <span
                      key={sk}
                      style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card__footer">
                <Link to={`/profile/${stud.id}`} className="btn btn-secondary btn-sm">
                  Портфолио
                </Link>

                {canInvite && <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSelectedStudentForInvite(stud)}
                >
                  <Send size={13} /> Пригласить
                </button>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {canInvite && selectedStudentForInvite && (
        <InviteStudentModal
          student={selectedStudentForInvite}
          isOpen={true}
          onClose={() => setSelectedStudentForInvite(null)}
        />
      )}

      <CreateTeamModal isOpen={teamModalOpen} onClose={() => setTeamModalOpen(false)} />
    </div>
  )
}
