import type {
  User,
  Company,
  CaseProject,
  StudentProject,
  ProjectMilestone,
} from '../../types/models'
import {
  studentNames,
  specializations,
  companyBriefs,
  caseBriefs,
  portfolioBriefs,
} from './catalog'

export const studentId = (index: number) =>
  index < 3
    ? 'usr_student_' + (index + 1)
    : index < 15
      ? 'demo_student_' + (index - 3)
      : 'showcase_student_' + (index - 15)
export const companyId = (index: number) =>
  index < 4 ? 'comp_' + (index + 1) : 'showcase_company_' + (index - 4)
export const caseId = (index: number) =>
  index < 5 ? 'case_' + (index + 1) : 'showcase_case_' + (index - 5)

export function buildStudents(): User[] {
  return studentNames.map((fullName, index) => {
    const profile = specializations[index % specializations.length]
    return {
      id: studentId(index),
      username: index === 0 ? 'student' : 'student_' + String(index + 1).padStart(2, '0'),
      fullName,
      email: 'student.' + (index + 1) + '@students.example',
      role: 'student',
      createdAt: '2026-09-' + String(1 + (index % 20)).padStart(2, '0') + 'T09:00:00Z',
      studentProfile: {
        university: 'Уфимский университет науки и технологий (УУНиТ)',
        institute: 'Институт информатики, математики и робототехники',
        fieldOfStudy: profile.program,
        educationalProgram: profile.program,
        educationLevel: 'Бакалавриат',
        course: profile.course,
        group: profile.group + '-' + profile.course + '01',
        bio:
          profile.bio +
          ' Работаю над темой: ' +
          portfolioBriefs[index % portfolioBriefs.length].title +
          '.',
        interests: [profile.direction, companyBriefs[index % companyBriefs.length].industry],
        skills: [...profile.skills],
        techStack: [...profile.skills],
        githubUrl: '',
        phone: '',
        rating: 0,
        verifiedProjectsCount: 0,
        winsCount: 0,
        curatorId: index % 3 === 0 ? 'showcase_curator' : 'usr_curator_1',
      },
    }
  })
}

export function buildCompanies(): Company[] {
  return companyBriefs.map((item, index) => ({
    id: companyId(index),
    name: 'ООО «' + item.name + '»',
    shortName: item.name,
    logo: '/demo/company.svg',
    description: item.description,
    industry: item.industry,
    website: '',
    email: 'projects@company-' + (index + 1) + '.example',
    phone: '',
    contactPerson: ['Роман Семёнов', 'Ирина Котова', 'Денис Хакимов', 'Светлана Юдина'][index % 4],
    directions: [...item.directions],
    techStack: [...item.tech],
    activeCasesCount: 0,
    completedProjectsCount: 0,
    isVerified: index < 11,
    isModerated: true,
  }))
}

export function buildCases(): CaseProject[] {
  const companies = buildCompanies()
  return caseBriefs.map((item, index) => {
    const company = companies[item.company]
    const status =
      index === 0 ? 'in_progress' : index >= 41 ? 'moderation' : index === 40 ? 'revision' : 'open'
    return {
      id: caseId(index),
      title: item.title,
      kind: 'case',
      companyId: company.id,
      companyName: company.name,
      companyLogo: company.logo,
      shortDescription: item.problem,
      fullDescription:
        '## Контекст\n\n' +
        item.problem +
        '\n\n## Что нужно сделать\n\n' +
        item.result +
        '\n\n## Условия\n\nКомпания предоставляет учебные данные и еженедельную консультацию наставника. Решение должно запускаться по инструкции на компьютере проверяющего.',
      direction: item.direction,
      complexity: index % 4 === 0 ? 'Высокий' : index % 3 === 0 ? 'Начальный' : 'Средний',
      participationFormat: index % 4 === 2 ? 'individual' : 'both',
      teamSize: index % 4 === 2 ? { min: 1, max: 1 } : { min: 1, max: 4 },
      requiredCompetencies: [...item.tech],
      recommendedTech: [...item.tech],
      deadlineDate: '2027-02-' + String(5 + (index % 22)).padStart(2, '0'),
      duration: index % 3 === 0 ? '8 недель' : '6 недель',
      workFormat: index % 5 === 0 ? 'смешанный' : 'дистанционный',
      resultRequirements:
        item.result + ' Приложите исходный код, сценарии проверки и инструкцию запуска.',
      evaluationOrder:
        'Наставник проверяет выполнение требований, воспроизводимость запуска и обработку граничных случаев. Команда показывает решение на итоговой встрече.',
      evaluationCriteria: [
        { id: 'quality', label: 'Выполнение требований', weight: 1, maxScore: 10 },
        { id: 'architecture', label: 'Качество реализации', weight: 1, maxScore: 10 },
      ],
      rewardType: 'educational',
      rewardDescription: 'Рецензия наставника и подтверждение выполненной работы для портфолио.',
      paymentStatus: 'not_provided',
      status,
      moderationStatus:
        status === 'moderation' ? 'pending' : status === 'revision' ? 'revision' : 'approved',
      moderationComment:
        status === 'revision' ? 'Уточните состав входных данных и критерии приёмки.' : undefined,
      isConfidential: false,
      ipRights: 'author',
      ipRightsDescription: 'Права на учебное решение остаются у авторов.',
      publishedAt: status === 'open' || status === 'in_progress' ? '2026-11-10' : '',
      viewsCount: 30 + index * 7,
      applicationsCount: 0,
      ...(index === 0
        ? {
            assignedTeamId: 'team_alpha',
            assignedTeamName: 'Вектор',
            curatorId: 'usr_curator_1',
            curatorName: 'Елена Ахметова',
          }
        : {}),
      isModerated: status === 'open' || status === 'in_progress',
    }
  })
}

export function buildPortfolio(): StudentProject[] {
  const students = buildStudents()
  return portfolioBriefs.map((item, index) => {
    const owner = students[index < 3 ? [2, 0, 1][index] : index]
    const moderationStatus = index === 13 ? 'revision' : index === 14 ? 'pending' : 'approved'
    return {
      id: index < 3 ? 'sp_' + (index + 1) : 'showcase_project_' + (index - 3),
      authorId: owner.id,
      authorName: owner.fullName,
      title: item.title,
      coverImage: '/demo/project.svg',
      category: index % 3 === 0 ? 'курсовой' : index % 3 === 1 ? 'pet-проект' : 'командный проект',
      shortDescription: item.result,
      fullDescription:
        '## Проблема\n\n' +
        item.problem +
        '\n\n## Реализация\n\n' +
        item.result +
        '\n\n## Дальнейшее развитие\n\nПланируется проверить решение на расширенном наборе сценариев и собрать обратную связь пользователей.',
      problemSolved: item.problem,
      technologies: [...item.tech],
      direction: item.direction,
      createdAt: '2026-10-' + String(2 + index).padStart(2, '0'),
      status: index % 3 === 1 ? 'готовый продукт' : 'в разработке',
      githubUrl: '',
      productUrl: '',
      screenshots: index === 1 ? ['/demo/pytest-preview.svg'] : [],
      badges: index % 2 === 0 ? ['seeking_mentor'] : ['open_for_internship'],
      isModerated: moderationStatus === 'approved',
      moderationStatus,
      moderationComment:
        moderationStatus === 'revision'
          ? 'Добавьте описание сценария запуска симулятора.'
          : undefined,
      visibility: 'public',
      likesCount: 4 + index * 2,
    }
  })
}

export function buildMilestones(cases: CaseProject[]): ProjectMilestone[] {
  return cases.flatMap((project) =>
    [
      [
        'Анализ задачи',
        'Согласовать сценарии, входные данные и критерии готовности. Подготовить короткий план проверки.',
      ],
      ['Рабочий прототип', project.resultRequirements],
      [
        'Проверка и защита',
        'Показать основной сценарий, результаты тестирования и известные ограничения. Приложить инструкцию запуска.',
      ],
    ].map(([title, description], index) => ({
      id: project.id + '_stage_' + index,
      caseId: project.id,
      stepNumber: index + 1,
      title,
      description,
      deadline: '2027-01-' + [10, 20, 30][index],
      status: 'pending' as const,
      attachedMaterials: [],
    })),
  )
}

export const textAttachment = (name: string, content: string) => ({
  name,
  url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(content),
  mimeType: 'text/plain',
})
