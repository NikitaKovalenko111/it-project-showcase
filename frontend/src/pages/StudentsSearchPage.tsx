import { IdentityImage } from '../components/IdentityImage'
import { PaginatedGrid } from '../components/PaginatedGrid'
import { canModerate, matchesSearch } from '../utils/publication'
import { apiRuntime } from '../api/runtime'
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
  const { studentsList, loading, error: studentsError } = useAppSelector((state) => state.students)
  const { casesList } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [search, setSearch] = useState('')
  const [institute, setInstitute] = useState('all')
  const [course, setCourse] = useState('all')
  const [groupSearch, setGroupSearch] = useState('')
  const [education, setEducation] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [skill, setSkill] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [ratingOrder, setRatingOrder] = useState('desc')

  const [selectedStudentForInvite, setSelectedStudentForInvite] = useState<User | null>(null)
  const [teamModalOpen, setTeamModalOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchStudentsRequest())
    dispatch(fetchTeamsRequest())
  }, [dispatch])

  // Filtering
  const filteredStudents = studentsList
    .filter((s) => {
      const prof = s.studentProfile
      if (s.role !== 'student' || !prof) return false

      if (
        !matchesSearch(
          search,
          s.fullName,
          prof.group,
          prof.fieldOfStudy,
          prof.skills,
          prof.techStack,
        )
      )
        return false

      if (groupSearch && !prof.group.toLowerCase().includes(groupSearch.trim().toLowerCase()))
        return false
      if (education !== 'all' && prof.educationLevel !== education) return false
      if (onlyMine && prof.curatorId !== currentUser?.id) return false
      if (institute !== 'all' && prof.institute !== institute) return false
      if (course !== 'all' && prof.course !== Number(course)) return false
      if (
        skill &&
        ![...prof.skills, ...prof.techStack].some((sk) =>
          sk.toLowerCase().includes(skill.trim().toLowerCase()),
        )
      )
        return false
      if (minRating > 0 && prof.rating < minRating) return false

      return true
    })
    .sort(
      (a, b) =>
        (ratingOrder === 'desc' ? 1 : -1) *
        ((b.studentProfile?.rating || 0) - (a.studentProfile?.rating || 0)),
    )

  const canInvite = currentUser?.role === 'company'
  const hasGroups = apiRuntime.mode !== 'live' || studentsList.some((s) => s.studentProfile?.group)
  const hasEducationLevels =
    apiRuntime.mode !== 'live' || studentsList.some((s) => s.studentProfile?.educationLevel)
  const institutes = [
    ...new Set(studentsList.map((student) => student.studentProfile?.institute).filter(Boolean)),
  ]

  // Recommended students algorithm based on matching company cases technologies
  const companyTech = new Set(
    casesList
      .filter((project) => project.companyId === currentUser?.companyProfile?.companyId)
      .flatMap((project) => project.requiredCompetencies.map((tech) => tech.toLowerCase())),
  )
  const recommendedCandidates = filteredStudents
    .filter((student) =>
      [
        ...(student.studentProfile?.skills || []),
        ...(student.studentProfile?.techStack || []),
      ].some((tech) => companyTech.has(tech.toLowerCase())),
    )
    .slice(0, 3)

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__content">
          <h1>
            {currentUser?.role === 'curator'
              ? 'Студенты и группы'
              : 'Поиск студентов и проектных команд'}
          </h1>
          <p>
            {canInvite
              ? 'Подбирайте исполнителей по компетенциям и приглашайте в свои кейсы.'
              : 'Группы, компетенции, рейтинг и портфолио студентов.'}
          </p>
        </div>
        {currentUser?.role === 'student' && (
          <div className="page-header__actions">
            <button className="btn btn-secondary" onClick={() => setTeamModalOpen(true)}>
              <Plus size={16} /> Создать проектную команду
            </button>
          </div>
        )}
      </div>

      {/* Recommended Section */}
      {canInvite && recommendedCandidates.length > 0 && (
        <div
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
              Рекомендованные кандидаты под требования ИТ-кейсов
            </h3>
          </div>

          <div
            className="responsive-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '14px',
            }}
          >
            {recommendedCandidates.map((cand) => (
              <div
                className="recommended-student"
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
                  <IdentityImage
                    src={cand.avatar}
                    name={cand.fullName}
                    className="candidate-avatar"
                  />
                  <div>
                    <Link className="profile-link" to={`/profile/${cand.id}`}>
                      <strong style={{ fontSize: '13px', display: 'block' }}>
                        {cand.fullName}
                      </strong>
                    </Link>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {cand.studentProfile?.fieldOfStudy.split(' ')[1] || 'ИТ-направление'} •{' '}
                      {cand.studentProfile?.course} курс
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#d97706',
                        marginTop: '2px',
                      }}
                    >
                      <Star size={12} fill="#d97706" /> Рейтинг:{' '}
                      <strong>{cand.studentProfile?.rating}</strong>
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
        </div>
      )}

      {/* Filter Bar */}
      <div className="uust-container">
        <div className="uust-box">
          <div className="uust-filter-row">
            <label className="catalog-filter">
              {hasGroups ? 'ФИО, группа или компетенция' : 'ФИО или компетенция'}
              <input
                className="uust-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={hasGroups ? 'ФИО, группа, React, Python…' : 'ФИО, React, Python…'}
              />
            </label>
          </div>
          <div className="uust-filter-row">
            <label className="catalog-filter">
              Институт
              <select
                className="uust-select"
                value={institute}
                onChange={(e) => setInstitute(e.target.value)}
              >
                <option value="all">Все институты</option>
                {institutes.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            {hasGroups && canModerate(currentUser) && (
              <label className="catalog-filter">
                Поиск по группе
                <input
                  className="uust-input"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Группа"
                />
              </label>
            )}
            {hasEducationLevels && (
              <label className="catalog-filter">
                Уровень обучения
                <select
                  className="uust-select"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                >
                  <option value="all">Все уровни</option>
                  {['Бакалавриат', 'Специалитет', 'Магистратура', 'Аспирантура'].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="catalog-filter">
              Курс
              <select
                className="uust-select"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                <option value="all">Любой курс</option>
                {[1, 2, 3, 4, 5, 6].map((year) => (
                  <option key={year} value={year}>
                    {year} курс
                  </option>
                ))}
              </select>
            </label>
            <label className="catalog-filter">
              Навык или технология
              <input
                className="uust-input"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="Например, Docker"
              />
            </label>
            <label className="catalog-filter">
              Рейтинг
              <select
                className="uust-select"
                value={ratingOrder}
                onChange={(e) => setRatingOrder(e.target.value)}
              >
                <option value="desc">По убыванию</option>
                <option value="asc">По возрастанию</option>
              </select>
            </label>
          </div>
          <div className="uust-pills-row">
            <span aria-live="polite">Найдено студентов: {filteredStudents.length}</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('')
                setInstitute('all')
                setCourse('all')
                setSkill('')
                setMinRating(0)
                setRatingOrder('desc')
                setGroupSearch('')
                setEducation('all')
                setOnlyMine(false)
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>
      {studentsError && <p role="alert">{studentsError}</p>}
      {loading && <p role="status">Загрузка студентов…</p>}
      {!loading && filteredStudents.length === 0 && (
        <p>Студенты по заданным фильтрам не найдены.</p>
      )}

      {/* Students List Grid */}
      <PaginatedGrid>
        {filteredStudents.map((stud) => {
          const prof = stud.studentProfile!

          return (
            <div key={stud.id} className="card card-hover">
              <div className="card__body">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    marginBottom: '14px',
                  }}
                >
                  <IdentityImage
                    src={stud.avatar}
                    name={stud.fullName}
                    className="student-search-avatar"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/profile/${stud.id}`}>
                      <h3 style={{ margin: '0 0 2px', fontSize: '15px', color: '#0f2b48' }}>
                        {stud.fullName}
                      </h3>
                    </Link>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {[
                        prof.group && `Группа ${prof.group}`,
                        prof.course > 0 && `${prof.course} курс`,
                        prof.fieldOfStudy,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '4px',
                      }}
                    >
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

                <p
                  style={{
                    margin: '0 0 14px',
                    fontSize: '12px',
                    color: '#334155',
                    lineHeight: 1.5,
                  }}
                >
                  {prof.bio}
                </p>

                {/* Skills */}
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}
                >
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

                {canInvite && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedStudentForInvite(stud)}
                  >
                    <Send size={13} /> Пригласить
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </PaginatedGrid>

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
