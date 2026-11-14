import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Layers, FileCheck2, Award } from 'lucide-react'
import { communityApi } from '../api/community'
import type { CaseProject, User } from '../types/models'
import type { Execution } from '../types/execution'
import { PaginationControls } from './PaginatedGrid'

export function CuratorOverview({
  projects,
  students,
}: {
  projects: CaseProject[]
  students: User[]
}) {
  const [entries, setEntries] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(5)
  const caseKey = projects
    .map((project) => project.id)
    .sort()
    .join('|')
  const studentKey = students
    .map((student) => student.id)
    .sort()
    .join('|')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setEntries([])
    setPage(1)
    const ids = caseKey ? caseKey.split('|') : []
    Promise.allSettled(ids.map((id) => communityApi.getExecutions(id))).then((results) => {
      if (!active) return
      const assigned = new Set(studentKey.split('|'))
      setEntries(
        results
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .filter((entry) => entry.members.some((member) => assigned.has(member.id))),
      )
      if (results.some((result) => result.status === 'rejected'))
        setError(
          'Не удалось загрузить часть работ. Откройте мониторинг проектов, чтобы повторить загрузку.',
        )
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [caseKey, studentKey])
  const accepted = entries.reduce(
    (count, entry) =>
      count + (entry.milestones?.filter((stage) => stage.status === 'accepted').length || 0),
    0,
  )
  const stats = [
    { icon: Users, color: 'blue', value: students.length, label: 'Закреплённые студенты' },
    { icon: Layers, color: 'emerald', value: entries.length, label: 'Команды и участники' },
    { icon: FileCheck2, color: 'purple', value: accepted, label: 'Принятые этапы' },
    {
      icon: Award,
      color: 'amber',
      value: entries.filter((entry) => entry.evaluation).length,
      label: 'Оценённые решения',
    },
  ]
  const pages = Math.max(1, Math.ceil(entries.length / size))
  const current = Math.min(page, pages)
  return (
    <>
      <div className="home-stats-grid curator-overview-stats">
        {stats.map(({ icon: Icon, color, value, label }) => (
          <div className="stat-card" key={label}>
            <div className={'stat-card__icon stat-icon--' + color}>
              <Icon size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">
                {loading && label !== 'Закреплённые студенты' ? '…' : value}
              </div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>
      <section className="home-section curator-monitoring">
        <div className="home-section__header">
          <h2>Проектные команды на контроле</h2>
          <Link to="/workspace" className="home-section__link">
            Все работы
          </Link>
        </div>
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p role="status">Загружаем работы…</p>
        ) : entries.length ? (
          <>
            <div className="table-container">
              <table className="data-table curator-progress-table">
                <thead>
                  <tr>
                    <th>Команда / участник</th>
                    <th>Задание</th>
                    <th>Капитан / исполнитель</th>
                    <th>Прогресс по этапам</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice((current - 1) * size, current * size).map((entry) => {
                    const project = projects.find((item) => item.id === entry.caseId)
                    const leader = entry.members[0]
                    const student = students.find((item) => item.id === leader?.id)
                    const total = entry.milestones?.length || 0
                    const done =
                      entry.milestones?.filter((stage) => stage.status === 'accepted').length || 0
                    return (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.name}</strong>
                          <small>
                            {entry.members.length} участн.
                            {student?.studentProfile?.group
                              ? ' · ' + student.studentProfile.group
                              : ''}
                          </small>
                        </td>
                        <td>
                          {project?.title}
                          <small>{project?.companyName}</small>
                        </td>
                        <td>{leader?.name || 'Не указан'}</td>
                        <td>
                          <div className="curator-stage-progress">
                            <progress
                              value={done}
                              max={total || 1}
                              aria-label={'Принятые этапы: ' + done + ' из ' + total}
                            />
                            <span>
                              {done} из {total}
                            </span>
                          </div>
                          <small>
                            {entry.evaluation
                              ? 'Решение оценено'
                              : entry.submission
                                ? 'Результат на проверке'
                                : 'В работе'}
                          </small>
                        </td>
                        <td>
                          <Link
                            className="btn btn-secondary btn-sm"
                            to={
                              '/cases/' +
                              entry.caseId +
                              '/workspace?execution=' +
                              encodeURIComponent(entry.id)
                            }
                          >
                            Просмотр этапов
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PaginationControls
              current={current}
              pages={pages}
              size={size}
              pageSize={5}
              change={(next, count = size) => {
                setPage(next)
                setSize(count)
              }}
            />
          </>
        ) : (
          <p className="card empty-state">У закреплённых студентов пока нет активных работ.</p>
        )}
      </section>
    </>
  )
}
