import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createTeamRequest } from '../../store/actions'
import { TeamMember } from '../../types/models'
import { Plus, Trash2, Users, X } from 'lucide-react'

interface CreateTeamModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)

  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: currentUser?.id || 'usr_student_1',
      name: currentUser?.fullName || 'Иван Петров',
      role: 'Team Lead',
      competencies: ['Python', 'React', 'Management'],
      email: currentUser?.email,
    },
    {
      id: 'mem_2',
      name: 'Мария Васильева',
      role: 'Frontend Developer',
      competencies: ['React', 'TypeScript', 'UI/UX'],
      email: 'vasilieva.m@uust.ru',
    },
  ])

  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('Backend Developer')
  const [newMemberSkills, setNewMemberSkills] = useState('Python, PostgreSQL')

  if (!isOpen) return null

  const rolesList = [
    'Team Lead',
    'Backend Developer',
    'Frontend Developer',
    'Mobile Developer',
    'Data Scientist',
    'ML Engineer',
    'DevOps Engineer',
    'QA Engineer',
    'Designer',
    'Analyst',
    'Project Manager',
  ]

  const handleAddMember = () => {
    if (!newMemberName.trim()) return
    setMembers([
      ...members,
      {
        id: `mem_${Date.now()}`,
        name: newMemberName,
        role: newMemberRole,
        competencies: newMemberSkills.split(',').map((s) => s.trim()).filter(Boolean),
      },
    ])
    setNewMemberName('')
    setNewMemberSkills('')
  }

  const handleRemoveMember = (idx: number) => {
    if (idx === 0) return // cannot remove leader
    setMembers(members.filter((_, i) => i !== idx))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) return

    dispatch(
      createTeamRequest({
        name: teamName,
        leaderId: currentUser?.id || 'usr_student_1',
        leaderName: currentUser?.fullName || 'Иван Петров',
        members,
      })
    )

    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={22} color="#1b5e91" />
            <div>
              <h3>Формирование проектной команды</h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Фиксация состава участников, ролей и компетенций
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog__body">
            <div className="form-group">
              <label>Название команды:*</label>
              <input
                type="text"
                className="input"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Например: NeuralKoders, UfaDevs, CyberShield..."
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Состав команды ({members.length} участн.):
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.map((m, idx) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: idx === 0 ? '#eff6ff' : '#f8fafc',
                      border: idx === 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{m.name}</strong>{' '}
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#1b5e91',
                          fontWeight: 600,
                          background: '#dbeafe',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginLeft: '6px',
                        }}
                      >
                        {m.role}
                      </span>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Навыки: {m.competencies.join(', ')}
                      </div>
                    </div>

                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                        title="Удалить участника"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add member subform */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                padding: '14px',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '10px' }}>
                Добавить участника в команду:
              </span>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>ФИО студента:</label>
                  <input
                    type="text"
                    className="input"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Артур Каримов"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Роль в проекте:</label>
                  <select
                    className="select"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    {rolesList.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Компетенции:</label>
                  <input
                    type="text"
                    className="input"
                    value={newMemberSkills}
                    onChange={(e) => setNewMemberSkills(e.target.value)}
                    placeholder="Go, Docker"
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddMember}
                  style={{ height: '38px' }}
                >
                  <Plus size={16} /> Добавить
                </button>
              </div>
            </div>
          </div>

          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={!teamName.trim()}>
              <Plus size={16} /> Создать команду
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
