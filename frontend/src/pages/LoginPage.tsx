import { hasApprovedCompany } from '../utils/access'
import { isPhoneValid } from '../utils/validation'
import { PasswordInput } from '../components/PasswordInput'
import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { loginRequest, loginSuccess } from '../store/actions'
import {
  Landmark,
  Settings,
  Building2,
  CheckCircle2,
  GraduationCap,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react'

interface LoginPageProps {
  initialMode?: 'login' | 'register'
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode = 'login' }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated, loginErrorCode, currentUser } = useAppSelector(
    (state) => state.auth,
  )
  const live = apiRuntime.mode === 'live'

  useEffect(() => {
    if (isAuthenticated)
      navigate(
        live && currentUser?.role === 'company' && !hasApprovedCompany(currentUser)
          ? '/my-company'
          : '/',
        { replace: true },
      )
  }, [isAuthenticated, currentUser, live, navigate])
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [roleToRegister, setRoleToRegister] = useState<'student' | 'company' | 'curator'>('student')
  const [registerLogin, setRegisterLogin] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerNotice, setRegisterNotice] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const awaitingApproval =
    loginErrorCode === 'role_approval_pending' || (!!registerNotice && !error)

  // Registration fields - Student
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [institute, setInstitute] = useState(
    apiRuntime.mode === 'mock' ? 'Институт информатики, математики и робототехники' : '',
  )
  const [direction, setDirection] = useState('')
  const [course, setCourse] = useState(2)
  const [group, setGroup] = useState('')
  const [techStack, setTechStack] = useState('')
  const [consentPD, setConsentPD] = useState(false)

  // Registration fields - Company
  const [companyName, setCompanyName] = useState('')
  const [inn, setInn] = useState('')
  const [position, setPosition] = useState('')

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    dispatch(loginRequest(username, password))
  }

  const handleQuickLogin = (uname: string) => {
    dispatch(loginRequest(uname))
    navigate('/')
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (registering) return
    setRegisterError('')
    setRegisterNotice('')
    if (!consentPD) {
      setRegisterError('Подтвердите согласие на обработку персональных данных.')
      return
    }
    const passwordBytes = new TextEncoder().encode(registerPassword).length
    const normalizedEmail = email.trim().toLowerCase()
    if (roleToRegister === 'student' && !/^[^@\s]+@stud\.uust\.ru$/.test(normalizedEmail)) {
      setRegisterError('Укажите студенческую почту на домене @stud.uust.ru.')
      return
    }
    if (
      (roleToRegister === 'student' || (!live && roleToRegister === 'company')) &&
      !isPhoneValid(phone)
    ) {
      setRegisterError('Укажите телефон из 7–15 цифр.')
      return
    }
    if (
      roleToRegister === 'student' &&
      (fullName.trim().split(/\s+/).length < 2 ||
        !institute.trim() ||
        !direction.trim() ||
        direction.trim().toLowerCase() === 'не указано' ||
        !group.trim())
    ) {
      setRegisterError('Укажите фамилию и имя, институт, направление подготовки и учебную группу.')
      return
    }
    if (
      passwordBytes < 8 ||
      passwordBytes > 72 ||
      !/\p{L}/u.test(registerPassword) ||
      !/\p{Nd}/u.test(registerPassword) ||
      /[\s\p{Cc}]/u.test(registerPassword)
    ) {
      setRegisterError(
        'Пароль должен содержать букву и цифру, без пробелов, и занимать от 8 до 72 байт.',
      )
      return
    }

    if (
      !live &&
      roleToRegister === 'company' &&
      (!companyName.trim() || !position.trim() || fullName.trim().split(/\s+/).length < 2)
    ) {
      setRegisterError('Укажите название компании, фамилию и имя представителя и должность.')
      return
    }
    if (live && roleToRegister === 'company' && !fullName.trim()) {
      setRegisterError('Укажите ФИО.')
      return
    }

    const regData = {
      fullName: fullName.trim(),
      direction: direction.trim(),
      course,
      password: registerPassword,
      email: normalizedEmail,
      technologies: techStack
        .split(',')
        .map((technology) => technology.trim())
        .filter(Boolean),
      username: live ? registerLogin.trim().toLowerCase() : normalizedEmail.split('@')[0],
      role: roleToRegister,
      phone,
      group: roleToRegister === 'student' ? group.trim() : undefined,
      institute: roleToRegister === 'student' ? institute.trim() : undefined,
      companyName: roleToRegister === 'company' ? companyName.trim() : undefined,
      inn: roleToRegister === 'company' ? inn : undefined,
      position: roleToRegister === 'company' ? position.trim() : undefined,
    }

    setRegistering(true)
    try {
      if (live && roleToRegister !== 'student') {
        await apiClient.requestRole({
          username: regData.username,
          email: regData.email,
          password: regData.password,
          ...(roleToRegister === 'company'
            ? { role: 'company', fullName: regData.fullName }
            : { role: 'curator' }),
        })
        setRegisterNotice('Аккаунт зарегистрирован. Заявка на роль отправлена.')
        setUsername(regData.username)
        setRegisterPassword('')
        setPassword('')
        setMode('login')
        return
      }
      const newUser = await apiClient.register(regData)
      localStorage.removeItem('uust_logged_out')
      localStorage.setItem('uust_current_user', JSON.stringify(newUser))
      dispatch(loginSuccess(newUser))
      navigate('/')
    } catch (cause) {
      setRegisterError((cause as Error).message || 'Ошибка регистрации')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="login-page">
      <aside className="auth-intro" aria-label="Витрина IT-проектов">
        <img
          className="auth-intro__mark"
          src="/images/brand/mark.svg"
          alt=""
          width="56"
          height="56"
        />
        <h1>Витрина IT-проектов</h1>
        <img
          className="auth-intro__art"
          src="/images/brand/workspace.svg"
          alt=""
          width="400"
          height="340"
        />
      </aside>
      <div className="auth-card">
        <div className="auth-card__header">
          <h2>{mode === 'login' ? 'Вход в систему' : 'Регистрация'}</h2>

          <div className="auth-mode-tabs">
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
              <UserPlus size={14} /> Регистрация
            </button>
          </div>
        </div>

        {mode === 'login' ? (
          <div className="auth-card__body">
            {awaitingApproval && (
              <section
                className="card feature-panel"
                role="status"
                aria-label="Статус заявки на роль"
              >
                <h3>Ожидайте одобрения</h3>
                {registerNotice && <p>{registerNotice}</p>}
                <p>
                  После одобрения администратором войдите с указанным при регистрации логином или
                  почтой.
                </p>
              </section>
            )}
            {error && loginErrorCode !== 'role_approval_pending' && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label htmlFor="login-username">Логин или email:*</label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-label="Логин или email"
                  placeholder={
                    apiRuntime.mode === 'mock'
                      ? 'student, company, curator или admin'
                      : 'Введите логин или email'
                  }
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="login-password">Пароль:*</label>
                <PasswordInput
                  id="login-password"
                  aria-label="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Введите пароль"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginBottom: '24px' }}
                disabled={loading}
              >
                Войти в систему
              </button>
            </form>

            {/* Quick Demo Login Buttons */}
            {apiRuntime.mode === 'mock' && (
              <div className="auth-demo">
                <span className="auth-demo__title">Быстрый вход под тестовой ролью:</span>

                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleQuickLogin('student')}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <GraduationCap size={14} aria-hidden="true" /> Студент
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
            )}
          </div>
        ) : (
          /* REGISTRATION FORM */
          <form className="registration-form" onSubmit={handleRegisterSubmit}>
            <h3>Регистрация нового пользователя</h3>

            {/* Role Selector Tabs */}
            <div className="auth-role-tabs">
              <button
                type="button"
                className={`btn btn-sm ${roleToRegister === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRoleToRegister('student')}
              >
                <GraduationCap size={14} aria-hidden="true" /> Студент
              </button>
              <button
                type="button"
                className={`btn btn-sm ${roleToRegister === 'company' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRoleToRegister('company')}
              >
                <Building2 size={14} aria-hidden="true" /> Представитель компании
              </button>
              {apiRuntime.mode === 'live' && (
                <button
                  type="button"
                  className={`btn btn-sm ${roleToRegister === 'curator' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRoleToRegister('curator')}
                >
                  Куратор
                </button>
              )}
            </div>

            {registerError && (
              <p role="alert" className="form-error">
                {registerError}
              </p>
            )}
            {live && (
              <label className="form-group">
                Логин *
                <input
                  className="input"
                  autoComplete="username"
                  placeholder={`Например, ${{ student: 'student_01', company: 'partner_01', curator: 'curator_01' }[roleToRegister]}`}
                  title="От 3 до 32 символов: строчные латинские буквы, цифры, точки, дефисы и подчёркивания"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9._\-]+"
                  value={registerLogin}
                  onChange={(e) => setRegisterLogin(e.target.value)}
                />
              </label>
            )}
            {roleToRegister === 'student' ? (
              <>
                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
                >
                  <div className="form-group">
                    <label>ФИО студента:*</label>
                    <input
                      type="text"
                      className="input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Алексей Миронов"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="student-registration-email">Email (@stud.uust.ru):*</label>
                    <input
                      id="student-registration-email"
                      type="email"
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@stud.uust.ru"
                      required
                    />
                  </div>
                </div>

                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
                >
                  <div className="form-group">
                    <label htmlFor="registration-institute">Институт / факультет *</label>
                    <input
                      className="input"
                      id="registration-institute"
                      value={institute}
                      onChange={(e) => setInstitute(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="registration-direction">Направление подготовки *</label>
                    <input
                      id="registration-direction"
                      className="input"
                      placeholder="Например, программная инженерия"
                      required
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Курс:*</label>
                    <select
                      className="select"
                      value={course}
                      onChange={(e) => setCourse(Number(e.target.value))}
                    >
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
                      placeholder="ПИ-201"
                      required
                    />
                  </div>
                </div>

                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
                >
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
                    <label>Стек технологий</label>
                    <input
                      type="text"
                      className="input"
                      value={techStack}
                      onChange={(e) => setTechStack(e.target.value)}
                      placeholder="React, TypeScript, Python, PostgreSQL"
                    />
                  </div>
                </div>
              </>
            ) : live ? (
              <>
                {roleToRegister === 'company' && (
                  <label className="form-group">
                    ФИО *
                    <input
                      className="input"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={500}
                      placeholder="Фамилия Имя Отчество"
                      required
                    />
                  </label>
                )}
                <label className="form-group">
                  Рабочий email
                  <input
                    className="input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}
                >
                  <div className="form-group">
                    <label>Название компании:*</label>
                    <input
                      type="text"
                      className="input"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="ООО «ПромКонтур»"
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
                      inputMode="numeric"
                      pattern="[0-9]{10}|[0-9]{12}"
                      title="ИНН должен содержать 10 или 12 цифр"
                      required
                    />
                  </div>
                </div>

                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
                >
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

                <div
                  className="responsive-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
                >
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

            <div className="form-group">
              <label>
                Пароль *
                <PasswordInput
                  aria-label="Пароль при регистрации"
                  className="input"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </div>
            <div className="registration-form__submit">
              {/* Consent to Personal Data Processing (п. 7.42 ТЗ / 152-ФЗ) */}
              <div className="auth-consent">
                <label>
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

              {apiRuntime.mode === 'live' && roleToRegister !== 'student' && (
                <p className="form-hint">
                  Заявку на роль проверит администратор.
                  {roleToRegister === 'company' &&
                    ' После одобрения вы сможете создать компанию или принять приглашение.'}
                </p>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={!consentPD || registering}
              >
                {registering
                  ? 'Отправляем…'
                  : apiRuntime.mode === 'live' && roleToRegister !== 'student'
                    ? 'Отправить заявку на роль'
                    : 'Зарегистрироваться и войти'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
