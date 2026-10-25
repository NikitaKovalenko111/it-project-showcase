import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { loginRequest, loginSuccess } from '../store/actions'
import { mockServer } from '../api/mockServer'
import {
  Landmark,
  Settings,
  Building2,
  CheckCircle2,
  GraduationCap,
  Layers,
  Lock,
  LogIn,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react'

interface LoginPageProps {
  initialMode?: 'login' | 'register'
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode = 'login' }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error } = useAppSelector((state) => state.auth)

  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [roleToRegister, setRoleToRegister] = useState<'student' | 'company'>('student')
  const [username, setUsername] = useState('student')

  // Registration fields - Student
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [institute, setInstitute] = useState('Институт информатики, математики и робототехники')
  const [course, setCourse] = useState(2)
  const [group, setGroup] = useState('ТОП-204Б(73)')
  const [skills, setSkills] = useState('React, TypeScript, Python, Git')
  const [techStack, setTechStack] = useState('React, TypeScript, PostgreSQL')
  const [consentPD, setConsentPD] = useState(false)

  // Registration fields - Company
  const [companyName, setCompanyName] = useState('')
  const [inn, setInn] = useState('')
  const [position, setPosition] = useState('')

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    dispatch(loginRequest(username))
    navigate('/')
  }

  const handleQuickLogin = (uname: string) => {
    dispatch(loginRequest(uname))
    navigate('/')
  }

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!consentPD) {
      alert('Необходимо дать согласие на обработку персональных данных (№ 152-ФЗ)')
      return
    }

    const regData = {
      fullName,
      email,
      username: email.split('@')[0] || `user_${Date.now()}`,
      role: roleToRegister,
      phone,
      group: roleToRegister === 'student' ? group : undefined,
      institute: roleToRegister === 'student' ? institute : undefined,
      companyName: roleToRegister === 'company' ? companyName : undefined,
    }

    try {
      const newUser = mockServer.registerUser(regData)
      localStorage.removeItem('uust_logged_out')
      localStorage.setItem('uust_current_user', JSON.stringify(newUser))
      dispatch(loginSuccess(newUser))
      alert(`Регистрация успешна! Добро пожаловать, ${newUser.fullName}!`)
      navigate('/')
    } catch (err: any) {
      alert(err.message || 'Ошибка регистрации')
    }
  }

  return (
    <div className="login-page"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #091b2e 0%, #0f2b48 50%, #17395c 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        color: '#fff',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: mode === 'register' ? '780px' : '440px',
          background: '#ffffff',
          color: '#1e293b',
          borderRadius: '8px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0f2b48, #269eb8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              margin: '0 auto 12px',
              boxShadow: '0 8px 16px rgba(38, 158, 184, 0.3)',
            }}
          >
            <Layers size={28} />
          </div>

          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800, color: '#0f2b48' }}>
            АИС «Витрина ИТ-проектов»
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Витрина IT-проектов
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '18px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, border: 'none' }}
              onClick={() => setMode('login')}
            >
              <LogIn size={14} /> Вход в систему
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, border: 'none' }}
              onClick={() => setMode('register')}
            >
              <UserPlus size={14} /> Регистрация студента
            </button>
          </div>
        </div>

        {mode === 'login' ? (
          <div style={{ padding: '24px 32px 32px' }}>
            {error && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label>Логин или email:*</label>
                <div className="search-input-wrap">
                  <User size={16} className="search-icon" />
                  <input
                    type="text"
                    className="input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="student, company, curator или admin"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Пароль:*</label>
                <div className="search-input-wrap">
                  <Lock size={16} className="search-icon" />
                  <input
                    type="password"
                    className="input"
                    defaultValue="UustDemo2026!"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginBottom: '24px' }}>
                Войти в систему
              </button>
            </form>

            {/* Quick Demo Login Buttons */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '10px', textAlign: 'center' }}>
                Быстрый вход под тестовой ролью:
              </span>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickLogin('student')}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <GraduationCap size={14} aria-hidden="true" /> Студент (Иван)
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickLogin('company')}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Building2 size={14} aria-hidden="true" /> Компания (R&D)
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickLogin('curator')}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Landmark size={14} aria-hidden="true" /> Куратор
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickLogin('admin')}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Settings size={14} aria-hidden="true" /> Администратор
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} style={{ padding: '24px 32px 32px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', color: '#0c1938' }}>
              Регистрация нового пользователя
            </h3>

            {/* Role Selector Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${roleToRegister === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                onClick={() => setRoleToRegister('student')}
              >
                <GraduationCap size={14} aria-hidden="true" /> Студент
              </button>
              <button
                type="button"
                className={`btn btn-sm ${roleToRegister === 'company' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                onClick={() => setRoleToRegister('company')}
              >
                <Building2 size={14} aria-hidden="true" /> Представитель компании
              </button>
            </div>

            {roleToRegister === 'student' ? (
              <>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>ФИО студента:*</label>
                    <input
                      type="text"
                      className="input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Магасумов Алмаз Ильшатович"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email (@stud.uust.ru):*</label>
                    <input
                      type="email"
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="257576@stud.uust.ru"
                      required
                    />
                  </div>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>Институт / факультет:*</label>
                    <select className="select" value={institute} onChange={(e) => setInstitute(e.target.value)}>
                      <option value="Институт информатики, математики и робототехники">ИИМР</option>
                      <option value="Институт авиационных технологий и материалов">ИАТМ</option>
                      <option value="Физико-технический институт">ФТИ</option>
                      <option value="Институт электроники и биомедицины">ИЭБ</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Курс:*</label>
                    <select className="select" value={course} onChange={(e) => setCourse(Number(e.target.value))}>
                      <option value={1}>1 курс</option>
                      <option value={2}>2 курс</option>
                      <option value={3}>3 курс</option>
                      <option value={4}>4 курс</option>
                      <option value={5}>Магистратура</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Группа:*</label>
                    <input
                      type="text"
                      className="input"
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      placeholder="ТОП-204Б(73)"
                      required
                    />
                  </div>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>Телефон:</label>
                    <input
                      type="tel"
                      className="input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 (917) 000-00-00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Стек технологий:*</label>
                    <input
                      type="text"
                      className="input"
                      value={techStack}
                      onChange={(e) => setTechStack(e.target.value)}
                      placeholder="React, TypeScript, Python, PostgreSQL"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>Название компании:*</label>
                    <input
                      type="text"
                      className="input"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="ООО «БашНефтеАвтоматика»"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>ИНН компании:*</label>
                    <input
                      type="text"
                      className="input"
                      value={inn}
                      onChange={(e) => setInn(e.target.value)}
                      placeholder="0274123456"
                      required
                    />
                  </div>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>ФИО представителя:*</label>
                    <input
                      type="text"
                      className="input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Семенов Роман Викторович"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Должность:*</label>
                    <input
                      type="text"
                      className="input"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="Технический директор"
                      required
                    />
                  </div>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>Корпоративный Email:*</label>
                    <input
                      type="email"
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="partner@company.ru"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Рабочий телефон:*</label>
                    <input
                      type="tel"
                      className="input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 (347) 200-00-00"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Consent to Personal Data Processing (п. 7.42 ТЗ / 152-ФЗ) */}
            <div style={{ margin: '16px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={consentPD}
                  onChange={(e) => setConsentPD(e.target.checked)}
                  required
                />
                <span>
                  Я даю согласие на обработку персональных данных в соответствии с 152-ФЗ
                </span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={!consentPD}>
              Зарегистрироваться и войти
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
