export const roleLabels: Record<string, string> = {
  student: 'Студент',
  company: 'Компания',
  curator: 'Куратор',
  university: 'Сотрудник',
  admin: 'Администратор',
}

export const auditActionLabels: Record<string, string> = {
  auth_login: 'Вход в систему',
  evaluation_submit: 'Выставление оценки',
  status_change: 'Изменение статуса',
  moderation_action: 'Решение модератора',
  insert: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  user_blocked: 'Изменение блокировки',
  user_role_change: 'Смена роли',
  case_moderation: 'Модерация кейса',
  company_verification: 'Верификация компании',
}
export const auditObjectLabels: Record<string, string> = {
  user: 'Пользователь',
  User: 'Пользователь',
  CaseProject: 'Кейс',
  Company: 'Компания',
  case: 'Кейс',
  company: 'Компания',
  application: 'Заявка',
  student_project: 'Студенческий проект',
  submission: 'Сданная работа',
  role_request: 'Заявка на роль',
}
