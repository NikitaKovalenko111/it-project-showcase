import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import {
  addCommentRequest,
  fetchCaseByIdRequest,
  fetchCommentsRequest,
  fetchEvaluationRequest,
  fetchMilestonesRequest,
  fetchSubmissionRequest,
  submitMilestoneRequest,
  updateMilestoneStatusRequest,
} from '../store/actions'
import { canManageCase, participatesInCase } from '../utils/access'
import { MilestoneMaterials } from '../components/MilestoneMaterials'
import { MilestoneEditor } from '../components/MilestoneEditor'
import { fetchTeamsRequest, fetchStudentsRequest } from '../store/actions'
import { EvaluationModal } from '../components/modals/EvaluationModal'
import { ResultSubmissionModal } from '../components/modals/ResultSubmissionModal'
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileCode2,
  FileText,
  Github,
  Globe,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Star,
  Trophy,
  Upload,
  User,
  Users,
  Video,
} from 'lucide-react'

export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()

  const { activeCase, milestones, submission, evaluation, comments, loading, error } = useAppSelector(
    (state) => state.cases
  )
  const { currentUser } = useAppSelector((state) => state.auth)

  const { teamsList, studentsList } = useAppSelector((state) => state.students)

  const [activeTab, setActiveTab] = useState<'milestones' | 'submission' | 'team' | 'comments'>('milestones')
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false)
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false)
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    if (id) {
      dispatch(fetchTeamsRequest())
      dispatch(fetchStudentsRequest())
      dispatch(fetchCaseByIdRequest(id))
      dispatch(fetchMilestonesRequest(id))
      dispatch(fetchSubmissionRequest(id))
      dispatch(fetchEvaluationRequest(id))
      dispatch(fetchCommentsRequest(id))
    }
  }, [dispatch, id])

  if (error) return <div role="alert" className="card" style={{ padding: 24 }}>{error} <Link to="/workspace">К списку проектов</Link></div>

  if (loading || !activeCase || activeCase.id !== id) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>Загрузка рабочего пространства...</div>
  }

  const completedMilestonesCount = milestones.filter((m) => m.status === 'accepted').length
  const progressPercent = Math.round((completedMilestonesCount / (milestones.length || 7)) * 100)

  const isCompanyUser = canManageCase(currentUser, activeCase)
  const isParticipant = currentUser?.role === 'student' && participatesInCase(currentUser.id, activeCase, teamsList)
  const projectTeam = teamsList.find((team) => team.id === activeCase.assignedTeamId || team.caseId === activeCase.id)
  const projectMembers = projectTeam?.members.map((member) => ({
    ...member,
    name: studentsList.find((student) => student.id === member.id)?.fullName || member.name,
    skills: member.competencies,
  })) || []
  const hasFinalEvaluation = activeCase.status === 'completed' && !!submission && evaluation?.caseId === activeCase.id
  const displayedEvaluation = hasFinalEvaluation ? evaluation : null

  const handleMilestoneAccept = (milestoneId: string) => {
    dispatch(updateMilestoneStatusRequest(milestoneId, 'accepted', 'Этап проверен и принят заказчиком.'))
  }

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !currentUser) return

    dispatch(
      addCommentRequest({
        caseId: activeCase.id,
        authorId: currentUser.id,
        authorName: currentUser.fullName,
        authorRole: currentUser.role,
        authorAvatar: currentUser.avatar,
        content: commentText,
      })
    )

    setCommentText('')
  }

  return (
    <div className="workspace-page">
      {/* Back and Breadcrumb */}
      <div className="page-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div className="action-row">
          <Link to="/workspace" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> Назад</Link>
          <Link to={`/cases/${activeCase.id}`} className="btn btn-secondary btn-sm"><FileText size={15} /> Описание проекта</Link>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Рабочая страница проекта • ID: {activeCase.id}
        </div>
      </div>

      {/* Header Workspace Card */}
      <div className="workspace-page__header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 'min(280px, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="badge badge-status status-in_progress">
                Статус: {activeCase.status === 'completed' ? 'Выполнен' : 'Выполняется (в работе)'}
              </span>
              <span className="badge badge-direction">{activeCase.direction}</span>
              {displayedEvaluation?.winnerPlace && (
                <span className="badge badge-reward-contest" style={{ background: '#fef3c7', color: '#b45309' }}>
                  <Trophy size={13} /> {displayedEvaluation.winnerPlace} МЕСТО
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f2b48', margin: '0 0 6px' }}>
              {activeCase.title}
            </h1>

            <div style={{ fontSize: '13px', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>
                Заказчик: <strong>{activeCase.companyName}</strong>
              </span>
              <span>
                Исполнители: <strong>{activeCase.assignedTeamName || activeCase.assignedStudentName || 'Не назначены'}</strong>
              </span>
              <span>
                Куратор: <strong>{activeCase.curatorName || 'Не назначен'}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isParticipant && (
              <button className="btn btn-primary btn-sm" onClick={() => setSubmissionModalOpen(true)}>
                <Upload size={14} /> Сдать результат работы
              </button>
            )}

            {isCompanyUser && submission && (
              <button
                className="btn btn-accent btn-sm"
                onClick={() => setEvaluationModalOpen(true)}
              >
                <Award size={14} /> Оценить решение
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
            <span>Выполнение контрольных точек (этапов):</span>
            <span>
              {completedMilestonesCount} из {milestones.length} этапов ({progressPercent}%)
            </span>
          </div>
          <div className="workspace-page__progress-bar">
            <div className="fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'milestones' ? 'active' : ''}`}
          onClick={() => setActiveTab('milestones')}
        >
          <Clock size={16} /> Контрольные точки
          <span className="tab-counter">{milestones.length}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'submission' ? 'active' : ''}`}
          onClick={() => setActiveTab('submission')}
        >
          <FileCheck2 size={16} /> Результат и оценка
          {displayedEvaluation && <span className="tab-counter" style={{ background: '#dcfce7', color: '#166534' }}>{displayedEvaluation.totalScore}/100</span>}
        </button>

        <button
          className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <Users size={16} /> Проектная команда
        </button>

        <button
          className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          <MessageSquare size={16} /> Обсуждение и файлы
          <span className="tab-counter">{comments.length}</span>
        </button>
      </div>

      {/* TAB 1: MILESTONES (7 Этапов п. 5.10 ТЗ) */}
      {activeTab === 'milestones' && (
        <div className="workspace-page__milestones">
          {isCompanyUser && <MilestoneEditor caseId={activeCase.id} />}
          {milestones.length === 0 && <p>Контрольные точки ещё не добавлены.</p>}
          {milestones.map((m) => {
            const isCompleted = m.status === 'accepted'
            const isInProgress = m.status === 'in_progress'

            return (
              <div
                key={m.id}
                className={`milestone-item ${isCompleted ? 'status-accepted' : isInProgress ? 'status-in_progress' : ''}`}
              >
                <div className={`step-number ${isCompleted ? 'completed' : isInProgress ? 'current' : ''}`}>
                  {isCompleted ? '✓' : m.stepNumber}
                </div>

                <div className="step-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="step-title">{m.title}</div>
                    <span
                      className={`badge badge-status ${
                        isCompleted ? 'status-completed' : isInProgress ? 'status-open' : 'status-moderation'
                      }`}
                      style={{ fontSize: '10px' }}
                    >
                      {isCompleted
                        ? 'Зачтено'
                        : isInProgress
                        ? 'Выполняется'
                        : m.status === 'submitted'
                        ? 'На проверке'
                        : 'Ожидает'}
                    </span>
                  </div>

                  <div className="step-desc">{m.description}</div>
                  <div className="step-deadline">Срок сдачи: {new Date(m.deadline).toLocaleDateString('ru-RU')}</div>

                  {/* Attached Materials */}
                  {m.attachedMaterials.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {m.attachedMaterials.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#1b5e91',
                            fontWeight: 600,
                          }}
                        >
                          <Paperclip size={12} /> {file.name} ({file.size || 'файл'})
                        </a>
                      ))}
                    </div>
                  )}

                  {m.feedback && (
                    <div
                      style={{
                        marginTop: '8px',
                        background: '#ecfdf5',
                        borderLeft: '3px solid #10b981',
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: '#065f46',
                      }}
                    >
                      Рецензия заказчика: {m.feedback}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isCompanyUser && <MilestoneEditor caseId={activeCase.id} milestoneId={m.id} />}
                <div className="milestone-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {isParticipant && !isCompleted && <MilestoneMaterials milestoneId={m.id} />}

                  {isCompanyUser && m.status === 'submitted' && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleMilestoneAccept(m.id)}
                    >
                      <CheckCircle2 size={13} /> Зачесть этап
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB 2: SUBMISSION & EVALUATION */}
      {activeTab === 'submission' && (
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
          {/* Submission Info */}
          <div>
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card__header">
                <h3 style={{ margin: 0, fontSize: '16px' }}>Представленный результат проекта</h3>
                {isParticipant && (
                  <button className="btn btn-primary btn-sm" onClick={() => setSubmissionModalOpen(true)}>
                    {submission ? 'Обновить решение' : 'Сдать результат'}
                  </button>
                )}
              </div>
              <div className="card__body">
                {submission ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                        Описание решения:
                      </strong>
                      <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                        {submission.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <a
                        href={submission.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ justifyContent: 'flex-start' }}
                      >
                        <Github size={15} /> Исходный код: {submission.repoUrl}
                      </a>

                      {submission.demoUrl && (
                        <a
                          href={submission.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                        >
                          <Globe size={15} /> Работающий сервис / Демо: {submission.demoUrl}
                        </a>
                      )}

                      {submission.presentationUrl && (
                        <a
                          href={submission.presentationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                        >
                          <FileText size={15} /> Презентация проекта
                        </a>
                      )}

                      {submission.videoUrl && (
                        <a
                          href={submission.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                        >
                          <Video size={15} /> Видеодемонстрация
                        </a>
                      )}
                    </div>

                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                    <FileCode2 size={40} style={{ margin: '0 auto 10px' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      Студенты еще не загрузили финальный результат решения кейса.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Official Evaluation Card */}
          <div>
            <div className="card">
              <div className="card__header">
                <h3 style={{ margin: 0, fontSize: '16px' }}>Оценка компании</h3>
                {isCompanyUser && submission && (
                  <button className="btn btn-accent btn-sm" onClick={() => setEvaluationModalOpen(true)}>
                    <Award size={14} /> Оценить
                  </button>
                )}
              </div>
              <div className="card__body">
                {displayedEvaluation ? (
                  <div>
                    {/* Winner badge */}
                    {displayedEvaluation.winnerPlace && (
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                          border: '1px solid #f59e0b',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '16px',
                        }}
                      >
                        <Trophy size={28} color="#b45309" />
                        <div>
                          <strong style={{ fontSize: '14px', color: '#92400e', display: 'block' }}>
                            {displayedEvaluation.winnerPlace} МЕСТО В КОНКУРСЕ
                          </strong>
                          <span style={{ fontSize: '11px', color: '#78350f' }}>
                            Номинация: {evaluation.nomination || 'Лучшее решение'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Итоговый балл:</span>
                      <strong style={{ fontSize: '24px', color: '#0f2b48' }}>
                        {evaluation.totalScore} / 100
                      </strong>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Полнота решения:</span>
                        <strong>{evaluation.scores.solutionCompleteness} / 10</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Качество кода:</span>
                        <strong>{evaluation.scores.codeQuality} / 10</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Архитектура:</span>
                        <strong>{evaluation.scores.architecture} / 10</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Соответствие ТЗ:</span>
                        <strong>{evaluation.scores.specCompliance} / 10</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Соблюдение сроков:</span>
                        <strong>{evaluation.scores.deadlineCompliance} / 10</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Командная работа:</span>
                        <strong>{evaluation.scores.teamwork} / 10</strong>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '12px',
                        color: '#334155',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '4px', color: '#0f2b48' }}>
                        Отзыв компании ({evaluation.evaluatorName}):
                      </strong>
                      "{evaluation.feedback}"
                    </div>

                    <div
                      style={{
                        marginTop: '14px',
                        padding: '8px 12px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckCircle2 size={14} /> Отметка «Проект подтверждён компанией» внесена в портфолио студентов.
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                    <Award size={40} style={{ margin: '0 auto 10px' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      Оценка еще не выставлена. Дождитесь проверки решения представителем компании.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROJECT TEAM */}
      {activeTab === 'team' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '16px' }}>Состав проектной команды</h3>
            <span className="badge badge-direction">{projectTeam?.name || activeCase.assignedStudentName || 'Команда не назначена'}</span>
          </div>
          <div className="card__body">
            {projectMembers.length === 0 && <p>{activeCase.assignedStudentName ? `Индивидуальный исполнитель: ${activeCase.assignedStudentName}` : 'Участники ещё не назначены.'}</p>}
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {projectMembers.map((mem, idx) => (
                <Link to={`/profile/${mem.id}`}
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <img
                    src={mem.avatar}
                    alt=""
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <strong style={{ fontSize: '14px', color: '#1e293b', display: 'block' }}>{mem.name}</strong>
                    <div style={{ fontSize: '12px', color: '#1b5e91', fontWeight: 600 }}>{mem.role}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {mem.skills.join(', ')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMMENTS & DISCUSSION */}
      {activeTab === 'comments' && (
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '16px' }}>Обсуждение и комментарии проекта</h3>
          </div>
          <div className="card__body">
            <h4>Материалы проекта</h4>
            <div className="action-row" style={{ marginBottom: 20 }}>
              {[...milestones.flatMap((milestone) => milestone.attachedMaterials), ...(submission?.attachedFiles || [])].map((file, index) =>
                <a className="btn btn-secondary btn-sm" key={`${file.url}-${index}`} download={file.url.startsWith('data:') ? file.name : undefined} href={file.url} target="_blank" rel="noreferrer"><Paperclip size={13} /> {file.name}</a>)}
              {!milestones.some((milestone) => milestone.attachedMaterials.length > 0) && !submission?.attachedFiles.length && <p>Материалы ещё не добавлены.</p>}
            </div>
            <h4>Обсуждение</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', height: 'min(50vh, 440px)', overflowY: 'auto', overflowWrap: 'anywhere' }}>
              {comments.map((comm) => (
                <div
                  key={comm.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px 14px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <img
                    src={
                      comm.authorAvatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'
                    }
                    alt=""
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="discussion-message__meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{comm.authorName}</strong>
                      <span className="badge badge-direction" style={{ fontSize: '10px' }}>
                        {comm.authorRole === 'company'
                          ? 'Компания'
                          : comm.authorRole === 'curator'
                          ? 'Куратор'
                          : 'Студент'}
                      </span>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                        {new Date(comm.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                      {comm.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Post comment form */}
            <form className="discussion-compose" onSubmit={handlePostComment} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Напишите комментарий или вопрос куратору..."
                required
              />
              <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
                <Send size={15} /> Отправить
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <ResultSubmissionModal
        caseId={activeCase.id}
        caseTitle={activeCase.title}
        isOpen={submissionModalOpen}
        onClose={() => setSubmissionModalOpen(false)}
      />

      <EvaluationModal
        caseId={activeCase.id}
        caseTitle={activeCase.title}
        teamName={projectTeam?.name || activeCase.assignedTeamName || activeCase.assignedStudentName}
        companyId={activeCase.companyId}
        companyName={activeCase.companyName}
        isContest={activeCase.rewardType === 'contest'}
        isOpen={evaluationModalOpen}
        onClose={() => setEvaluationModalOpen(false)}
      />
    </div>
  )
}
