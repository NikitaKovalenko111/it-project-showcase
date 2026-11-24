import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios'
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
  invalid_representative_profile:
    'Укажите до 4 000 символов об опыте и до 2 000 символов о темах помощи.',
  event_plan_required:
    'Перед отправкой на модерацию заполните план мероприятия, расписание и сроки.',
  nda_version_required:
    'Откройте форму редактирования и сохраните текст NDA перед отправкой на модерацию.',
  event_round_not_open: 'Тур ещё не открыт.',
  event_round_already_submitted: 'Решение этого тура уже отправлено.',
  case_plan_changed: 'План изменился на сервере. Загрузите его заново.',
  case_stages_locked: 'План нельзя изменить: проект закрыт или этапы содержат работы участников.',
  case_plan_deadline: 'Для переноса укажите будущий срок и причину.',
  unsupported_file_type: 'Этот формат файла не поддерживается сервером.',
  file_too_large: 'Файл превышает допустимый размер.',
  invalid_file: 'Не удалось прочитать файл. Выберите другое изображение.',
  company_access_denied: 'У вас нет прав на управление этой компанией.',
  role_change_conflict:
    'Нельзя изменить собственную роль, роль администратора или назначить студента без студенческого профиля.',
  auth_unavailable: 'Сервис авторизации временно недоступен. Повторите попытку позже.',
  invalid_credentials: 'Неверный логин или пароль.',
  invalid_application_transition: 'Это действие больше недоступно для текущего статуса заявки.',
  team_invitation_conflict: 'Приглашение уже отправлено и ожидает ответа.',
  community_request_failed:
    'Сервер не смог обработать запрос обсуждения. Попробуйте обновить страницу.',
  account_temporarily_locked: 'Слишком много попыток входа. Попробуйте позже.',
  account_blocked: 'Учётная запись заблокирована.',
  permission_denied: 'У вас нет доступа к этому действию.',
  report_conflict: 'По этому объекту уже есть открытая жалоба.',
  username_taken: 'Этот логин уже занят.',
  pending_role_request_not_found: 'Заявка уже обработана или недоступна. Обновите очередь.',
  company_name_taken: 'Компания с таким названием уже существует.',
  email_taken: 'Этот email уже зарегистрирован.',
}

const fields: Record<string, string> = {
  full_name: 'ФИО',
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
          {
            status: error.response?.status,
            code: apiError?.code,
            ...(error.response?.status === 429 && {
              retryAfter: AxiosHeaders.from(error.response.headers).get('retry-after'),
            }),
          },
        ),
      )
    },
  )
  return client
}
