import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
type Options = {
  baseURL: string
  timeoutMs: number
  tokenStore: { get: () => string | null; set: (token: string) => void; clear: () => void }
  getRefreshToken: () => string | null
  saveRefreshToken: (token: string) => void
  onUnauthorized: () => void
  refreshTokens?: (token: string) => Promise<{ access_token: string; refresh_token: string }>
}
const messages: Record<string, string> = {
  invalid_credentials: 'Неверный логин или пароль.',
  account_temporarily_locked: 'Слишком много попыток входа. Попробуйте позже.',
  account_blocked: 'Учётная запись заблокирована.',
  permission_denied: 'У вас нет доступа к этому действию.',
  report_conflict: 'По этому объекту уже есть открытая жалоба.',
  username_taken: 'Этот логин уже занят.',
  email_taken: 'Этот email уже зарегистрирован.',
}

const fields: Record<string, string> = {
  first_name: 'Имя',
  last_name: 'Фамилия',
  patronymic: 'Отчество',
  email: 'Email',
  username: 'Логин',
  password: 'Пароль',
  institute: 'Институт',
  direction: 'Направление подготовки',
  group_name: 'Группа',
  program: 'Образовательная программа',
  course: 'Курс',
  phone: 'Телефон',
  bio: 'О себе',
  links: 'Ссылки профиля',
  profile: 'Навыки, технологии и интересы',
}

function validationMessage(detail?: { field: string; code: string }) {
  if (!detail) return 'Проверьте введённые данные.'
  if (detail.code === 'student_domain_required')
    return 'Укажите студенческую почту на домене @stud.uust.ru.'
  if (detail.code === 'weak_password') return 'Пароль должен содержать букву и цифру.'
  if (detail.code === 'invalid_link') return 'Укажите ссылки с http:// или https://.'
  if (detail.code === 'too_many_items') return 'В списке может быть не больше 50 элементов.'
  if (detail.field === 'phone') return 'Укажите телефон из 7–15 цифр.'
  const field = fields[detail.field]
  if (!field) return 'Проверьте введённые данные.'
  if (detail.code === 'required') return `Заполните поле «${field}».`
  if (detail.code === 'too_long') return `Сократите значение поля «${field}».`
  return `Проверьте значение поля «${field}».`
}

export function createHttpClient(options: Options) {
  const { tokenStore } = options
  const client = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeoutMs,
    headers: { Accept: 'application/json' },
  })
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  let refresh: Promise<void> | null = null
  const credentials = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
  const unauthorized = () => {
    tokenStore.clear()
    options.onUnauthorized()
  }
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<any>) => {
      const config = error.config as
        | (InternalAxiosRequestConfig & { _retried?: boolean })
        | undefined
      const url = config?.url || ''
      if (
        error.response?.status === 401 &&
        config &&
        !credentials.includes(url) &&
        !config._retried
      ) {
        const token = options.getRefreshToken()
        if (token) {
          config._retried = true
          try {
            if (!refresh)
              refresh = (
                options.refreshTokens
                  ? options.refreshTokens(token)
                  : axios
                      .post(`${options.baseURL}/auth/refresh`, { refresh_token: token })
                      .then((r) => r.data)
              )
                .then((data) => {
                  tokenStore.set(data.access_token)
                  options.saveRefreshToken(data.refresh_token)
                })
                .finally(() => {
                  refresh = null
                })
            await refresh
            config.headers.Authorization = `Bearer ${tokenStore.get()}`
            return client(config)
          } catch {
            /* The common unauthorized handler below clears the session once. */
          }
        }
      }
      if (error.response?.status === 401 && !credentials.includes(url)) unauthorized()
      const apiError = error.response?.data?.error
      const localized =
        apiError?.code === 'validation_failed'
          ? validationMessage(apiError.details?.[0])
          : messages[apiError?.code] ||
            (apiError?.code === 'conflict' && url === '/reports'
              ? messages.report_conflict
              : undefined)
      return Promise.reject(
        Object.assign(
          new Error(
            localized ||
              apiError?.message ||
              (error.response
                ? `Ошибка API (${error.response.status})`
                : 'Сервер недоступен. Проверьте подключение к API.'),
          ),
          { status: error.response?.status, code: apiError?.code },
        ),
      )
    },
  )
  return client
}
