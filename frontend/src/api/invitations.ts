export function invitationKind(type: string): 'case' | 'internship' | 'interview' | 'job' {
  const values: Record<string, 'case' | 'internship' | 'interview' | 'job'> = {
    'Участие в проекте': 'case',
    'Оплачиваемая стажировка': 'internship',
    'Техническое собеседование': 'interview',
    case: 'case',
    internship: 'internship',
    interview: 'interview',
    job: 'job',
  }
  const value = values[type]
  if (!value) throw new Error('Выберите тип приглашения')
  return value
}
export function createInvitationApi(http: any) {
  return {
    async send(
      companyId: string,
      studentId: string,
      caseId: string,
      type: string,
      message: string,
    ) {
      const kind = invitationKind(type)
      if (!companyId) throw new Error('Приглашение должно быть отправлено от компании.')
      if (kind === 'case' && !caseId) throw new Error('Выберите проект для приглашения.')
      await http.post(`/companies/${companyId}/student-invitations`, {
        student_id: studentId,
        case_id: kind === 'case' ? caseId : '',
        kind,
        message: message.trim(),
      })
    },
  }
}
