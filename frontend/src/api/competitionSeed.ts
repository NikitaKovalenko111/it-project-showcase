import { INITIAL_CASES, INITIAL_USERS } from './mockData'
import { buildStudents, textAttachment } from './fixtures/builders'
import { CaseProject, User, CaseApplication } from '../types/models'
import { Execution } from '../types/execution'
export function competitionSeed() {
  const cases: CaseProject[] = ['case', 'hackathon', 'olympiad'].map((kind, i) => ({
    ...structuredClone(INITIAL_CASES[0]),
    id: `demo_${kind}`,
    kind: kind as CaseProject['kind'],
    direction:
      kind === 'olympiad' ? 'Программирование' : kind === 'hackathon' ? 'Fullstack' : 'IoT',
    requiredCompetencies:
      kind === 'olympiad'
        ? ['Алгоритмы', 'Структуры данных', 'Оценка сложности']
        : kind === 'hackathon'
          ? ['Разработка интерфейсов', 'UX/UI', 'Работа с API']
          : ['Обработка данных', 'Временные ряды', 'REST API'],
    recommendedTech:
      kind === 'olympiad'
        ? ['Python', 'C++']
        : kind === 'hackathon'
          ? ['React', 'TypeScript', 'PostgreSQL']
          : ['Python', 'MQTT', 'React'],
    olympiadRules:
      kind === 'olympiad'
        ? 'Индивидуальное участие. Для каждой задачи приложите исходный код, объяснение алгоритма и оценку сложности. Баллы по задачам суммируются.'
        : undefined,
    title: [
      'Промышленный сервис мониторинга',
      'Хакатон «Умный кампус»',
      'Олимпиада по программированию',
    ][i],
    shortDescription: [
      'Разработайте сервис для сбора и анализа телеметрии оборудования.',
      'Предложите цифровое решение для студентов и сотрудников кампуса.',
      'Решите задачи на последовательности и графы.',
    ][i],
    fullDescription: [
      'Подготовьте прототип сервиса, который собирает показания датчиков и выявляет отклонения.',
      'Выберите задачу кампуса, соберите прототип и покажите его на защите.',
      'Сдайте решения задач с пояснением алгоритмов и оценкой сложности.',
    ][i],
    resultRequirements: [
      'Рабочий сервис, исходный код и инструкция запуска.',
      'Прототип сервиса для кампуса, презентация и демонстрация.',
      'Решения задач, исходный код и пояснения алгоритмов.',
    ][i],
    prizePlaces: undefined,
    prizeFund: undefined,
    rewardAmount: undefined,
    rewardType: 'educational',
    rewardDescription: [
      'Опыт разработки промышленного сервиса и рецензия компании.',
      'Практика командной разработки и обратная связь жюри.',
      'Сертификат участника и разбор решений.',
    ][i],
    status: 'in_progress',
    moderationStatus: 'approved',
    isModerated: true,
    isConfidential: false,
    assignedTeamId: undefined,
    assignedStudentId: undefined,
    assignedTeamName: undefined,
    assignedStudentName: undefined,
    participationFormat: kind === 'olympiad' ? 'individual' : 'team',
    teamSize: kind === 'olympiad' ? { min: 1, max: 1 } : { min: 1, max: 5 },
    deadlineDate: '2027-06-30',
    acceptedTeamsCount: kind === 'olympiad' ? 0 : 12,
    maxTeams: 50,
    applicationsCount: 12,
    publishedAt: '2026-11-02',
    evaluationCriteria:
      kind === 'olympiad'
        ? []
        : [
            { id: 'quality', label: 'Качество решения', weight: 1 },
            { id: 'architecture', label: 'Архитектура', weight: 1 },
          ],
    olympiadTasks:
      kind === 'olympiad'
        ? [
            {
              id: 'a',
              title: 'Задача A · самая длинная возрастающая подпоследовательность',
              maxScore: 30,
            },
            { id: 'b', title: 'Задача B · кратчайший путь между корпусами', maxScore: 70 },
          ]
        : undefined,
  }))
  const users: User[] = buildStudents().slice(3, 15)
  const specialists = buildStudents().slice(15)
  const executions: Execution[] = cases.flatMap((c) =>
    Array.from({ length: 12 }, (_, i) => {
      const user = i === 0 ? INITIAL_USERS[0] : users[i]
      const scores =
        c.kind === 'olympiad'
          ? { a: 20 + (i % 10), b: 40 + (i % 20) }
          : { quality: 5 + (i % 6), architecture: 6 + (i % 5) }
      return {
        id: `${c.id}_execution_${i}`,
        caseId: c.id,
        teamId: c.kind === 'olympiad' ? undefined : `${c.id}_team_${i}`,
        studentId: user.id,
        name:
          c.kind === 'olympiad'
            ? user.fullName
            : (c.kind === 'hackathon'
                ? [
                    'Орбита',
                    'Точка Сборки',
                    'Код Кампуса',
                    'Параллель',
                    'Маяк',
                    'Открытый Код',
                    'Синхрон',
                    'Квартал',
                    'Новый Маршрут',
                    'Горизонт',
                    'Траектория',
                    'Компас',
                  ]
                : [
                    'Импульс',
                    'Датапоток',
                    'Спектр',
                    'Порог',
                    'Контакт',
                    'Линия',
                    'Сенсорика',
                    'Сигма',
                    'ТехноРитм',
                    'Метроном',
                    'Резонанс',
                    'Модуль',
                  ])[i],
        members: [
          {
            id: user.id,
            name: user.fullName,
            role: c.kind === 'olympiad' ? 'Участник' : 'Капитан',
            competencies: [...user.studentProfile!.skills],
            ...(user.avatar ? { avatar: user.avatar } : {}),
          },
          ...(c.kind === 'olympiad'
            ? []
            : Array.from({ length: i % 4 }, (_, memberIndex) => {
                const specialist = specialists[(i * 3 + memberIndex) % specialists.length]
                return {
                  id: specialist.id,
                  name: specialist.fullName,
                  role: ['Разработчик интерфейса', 'Инженер данных', 'Тестировщик'][memberIndex],
                  competencies: [...specialist.studentProfile!.skills],
                }
              })),
        ],
        status: i < 4 ? 'evaluated' : i < 9 ? 'submitted' : 'active',
        submission:
          i < 9
            ? {
                id: `${c.id}_sub_${i}`,
                caseId: c.id,
                studentId: user.id,
                authorName: user.fullName,
                description:
                  c.kind === 'olympiad'
                    ? 'Для последовательности использован поиск позиции бинарным поиском, для графа — алгоритм Дейкстры. Проверены пустой ввод, несвязный граф и повторяющиеся значения.'
                    : c.kind === 'hackathon'
                      ? [
                          'Прототип поиска свободных аудиторий с фильтрами по вместимости и оборудованию.',
                          'Календарь консультаций с наставниками и проверкой пересечений времени.',
                          'Каталог студенческих событий с сохранением интересующих встреч.',
                        ][i % 3] +
                        ' Подготовлены основной сценарий, обработка пустого списка и инструкция демонстрации.'
                      : [
                          'Сбор телеметрии с проверкой пропусков и дубликатов.',
                          'Сравнение порогового метода с анализом скользящего среднего.',
                          'Панель датчиков с историей отклонений и пояснением предупреждений.',
                        ][i % 3] +
                        ' Прототип проверен на учебных данных; ограничения описаны в материалах.' +
                        (i % 2 === 0
                          ? '\n\nПодготовка данных: проверены единицы измерения, часовой пояс и порядок событий. Пропуски не заменяем нулями, а показываем как отдельное состояние. Повторные записи отбрасываются по сочетанию идентификатора датчика и времени.\n\nПроверка результата: сравнили штатную работу, кратковременное отключение датчика и скачок показаний. В журнале сохраняются причина сигнала и использованный порог. Известное ограничение: модель проверена на двух типах оборудования и требует повторной настройки при смене частоты измерений.'
                          : ''),
                repoUrl: 'https://example.org/#' + c.id + '-team-' + i + '-code',
                demoUrl:
                  c.kind !== 'olympiad' && i % 3 !== 2
                    ? 'https://example.org/#' + c.id + '-team-' + i + '-demo'
                    : undefined,
                documentationUrl: '/demo/documents/practice-1.pdf',
                presentationUrl: i % 2 === 0 ? '/demo/documents/project-1.svg' : undefined,
                screenshots: c.kind !== 'olympiad' && i % 3 === 0 ? ['/demo/project.svg'] : [],
                attachedFiles: [
                  textAttachment(
                    'Пояснение к решению.txt',
                    c.title +
                      '\n\n' +
                      c.resultRequirements +
                      '\n\nПроверка: основной сценарий, пустые данные, повторная отправка.\nОграничение: решение использует учебный набор данных.',
                  ),
                  textAttachment(
                    'Сценарии проверки.txt',
                    c.kind === 'olympiad'
                      ? 'Проверки алгоритмов:\n1. Последовательность из одного элемента.\n2. Убывающие и одинаковые значения.\n3. Граф без пути между вершинами.\n4. Несколько путей одинаковой длины.\n5. Максимальный размер входных данных.'
                      : '1. Открыть основной экран и проверить начальное состояние.\n2. Ввести корректные данные и проверить результат.\n3. Проверить пустые и повторяющиеся значения.\n4. Сопоставить результат с требованиями задания.',
                  ),
                ].slice(0, i % 3 === 1 ? 1 : 2),
                submittedAt: '2026-11-02T10:00:00Z',
              }
            : undefined,
        evaluation:
          i < 4
            ? {
                id: `${c.id}_eval_${i}`,
                caseId: c.id,
                companyId: c.companyId,
                companyName: c.companyName,
                evaluatorName: 'Роман Семёнов',
                scores,
                totalScore: Object.values(scores).reduce((a, b) => a + b, 0),
                maxScore: c.kind === 'olympiad' ? 100 : 20,
                feedback:
                  c.kind === 'olympiad'
                    ? 'Алгоритмы выбраны верно. В пояснении к задаче о графах нужно подробнее описать оценку сложности и случай отсутствия пути.'
                    : 'Основной сценарий воспроизводится. Рекомендуем расширить проверки некорректных данных и подробнее описать ограничения прототипа.',
                evaluatedAt: '2026-11-02T11:00:00Z',
              }
            : undefined,
      } as Execution
    }),
  )
  const teams = executions
    .filter((e) => e.teamId)
    .map((e) => ({
      id: e.teamId!,
      caseId: e.caseId,
      name: e.name,
      leaderId: e.members[0].id,
      leaderName: e.members[0].name,
      members: e.members,
      description:
        'Распределяем работу между участниками: согласование сценариев и проверка гипотез, подготовка данных, разработка прототипа и тестирование. ' +
        (e.members.length > 2
          ? 'Проводим взаимное ревью и фиксируем личный вклад каждого участника в итоговом отчёте. Сложные решения разбираем с наставником на еженедельной встрече.'
          : 'Сейчас сфокусированы на одном воспроизводимом сценарии; дополнительные функции добавим после проверки основного результата.'),
      createdAt: '2026-11-02',
    }))
  const applications: CaseApplication[] = executions.map((e) => {
    const c = cases.find((c) => c.id === e.caseId)!,
      u = [...INITIAL_USERS, ...users].find((u) => u.id === e.studentId)!
    return {
      id: `app_${e.id}`,
      caseId: e.caseId,
      caseTitle: c.title,
      companyId: c.companyId,
      applicantType: e.teamId ? 'team' : 'individual',
      studentId: u.id,
      studentName: u.fullName,
      studentEmail: u.email,
      studentPhone: u.phone || '',
      studentCourse: u.studentProfile?.course || 1,
      studentInstitute: u.studentProfile?.institute || '',
      teamId: e.teamId,
      teamName: e.teamId ? e.name : undefined,
      coverLetter:
        c.kind === 'olympiad'
          ? 'Изучаю алгоритмы на графах и динамическое программирование. Хочу проверить решения на ограничениях по времени и памяти.'
          : c.kind === 'hackathon'
            ? 'Предлагаем начать с коротких интервью со студентами и выбрать один сценарий кампуса. За время хакатона подготовим прототип и покажем его на защите.'
            : 'Работали с телеметрией и проверкой качества данных. Сначала согласуем формат измерений, затем подготовим обработку и интерфейс для инженера.',
      resumeUrl: '',
      portfolioUrl: '',
      githubUrl: '',
      previousProjects: [],
      status: 'accepted',
      createdAt: '2026-11-02T09:00:00Z',
    }
  })
  executions.forEach((e) => {
    e.applicationId = `app_${e.id}`
  })
  const pendingStudent = users[0],
    pendingCase = cases[0]
  applications.push({
    ...applications[0],
    id: 'demo_pending_application',
    caseId: pendingCase.id,
    studentId: pendingStudent.id,
    studentName: pendingStudent.fullName,
    studentEmail: pendingStudent.email,
    teamId: undefined,
    teamName: undefined,
    applicantType: 'individual',
    status: 'pending',
    coverLetter:
      'Знакома с обработкой временных рядов в Python. Готова подготовить отчёт о пропусках в данных и сравнить два способа выявления аномалий.',
  })
  return { cases, users, executions, teams, applications }
}
