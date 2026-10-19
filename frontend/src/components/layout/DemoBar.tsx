import React from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { switchUserRequest } from '../../store/actions'
import { mockServer } from '../../api/mockServer'
import { Sparkles, UserCheck } from 'lucide-react'

export const DemoBar: React.FC = () => {
  const dispatch = useAppDispatch()
  const { currentUser } = useAppSelector((state) => state.auth)
  const allUsers = mockServer.getUsers()

  const handleSelectRole = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId)
    if (user) {
      dispatch(switchUserRequest(user))
    }
  }

  return (
    <div className="demo-bar">
      <div className="demo-bar__label">
        <Sparkles size={14} className="text-cyan" />
        <span>ДЕМО-РЕЖИМ:</span>
        <span className="badge-demo">УУНиТ 2026</span>
      </div>

      <div className="demo-bar__roles">
        <span style={{ fontSize: '11px', color: '#8da4be', marginRight: '4px' }}>Переключить роль:</span>
        
        <button
          className={`demo-bar__role-btn ${currentUser?.id === 'usr_student_1' ? 'active' : ''}`}
          onClick={() => handleSelectRole('usr_student_1')}
          title="Студент-разработчик (Иван Петров, ПИ-301Б)"
        >
          🎓 Студент (Иван)
        </button>

        <button
          className={`demo-bar__role-btn ${currentUser?.id === 'usr_company_1' ? 'active' : ''}`}
          onClick={() => handleSelectRole('usr_company_1')}
          title="Представитель компании (БашНефтеАвтоматика)"
        >
          🏢 Компания (R&D)
        </button>

        <button
          className={`demo-bar__role-btn ${currentUser?.id === 'usr_curator_1' ? 'active' : ''}`}
          onClick={() => handleSelectRole('usr_curator_1')}
          title="Сотрудник / Куратор кафедры УУНиТ (Елена Ахметова)"
        >
          🏛️ Куратор УУНиТ
        </button>

        <button
          className={`demo-bar__role-btn ${currentUser?.id === 'usr_admin_1' ? 'active' : ''}`}
          onClick={() => handleSelectRole('usr_admin_1')}
          title="Главный администратор АИС УУНиТ"
        >
          ⚙️ Администратор
        </button>

        <button
          className={`demo-bar__role-btn ${currentUser?.id === 'usr_student_2' ? 'active' : ''}`}
          onClick={() => handleSelectRole('usr_student_2')}
          title="Студент-дизайнер (Мария Васильева, ИВТ-402)"
        >
          🎨 Студент (Мария)
        </button>
      </div>
    </div>
  )
}
