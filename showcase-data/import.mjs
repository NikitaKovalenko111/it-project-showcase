import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { earlyProjectDates, feedback, milestones as demoAchievements, reviews, semesterFund } from './activity.mjs'
import { demoCompanyCases } from './company-cases.mjs'
import { companyPrograms, companyQuestions } from './company-engagement.mjs'
import { companyDemoCoverage } from './company-demo-coverage.mjs'
import { basename, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (name) => JSON.parse(readFileSync(new URL(`data/${name}.json`, import.meta.url), 'utf8'))
const id = (key) => key ? createHash('sha256').update(`showcase-data:${key}`).digest('hex').slice(0, 32) : null
const sql = (value) => {
  if (value == null) return 'NULL'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  const content = typeof value === 'string' ? value : JSON.stringify(value)
  return `'${content.replaceAll("'", "''")}'`
}
const password = 'DemoShowcase2026!'
const statements = [
  'BEGIN',
  'SET LOCAL search_path = showcase, public',
  'SET LOCAL standard_conforming_strings = on',
  "SET LOCAL client_encoding = 'UTF8'",
  `DO $$ BEGIN IF current_database() <> 'showcase_demo' OR current_user <> 'showcase_demo'
     THEN RAISE EXCEPTION 'This import requires the isolated showcase_demo database'; END IF; END $$`,
  "SELECT pg_advisory_xact_lock(hashtext('showcase-data-import'))",
  'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public',
  `CREATE TEMP TABLE import_password AS SELECT public.crypt(${sql(password)}, public.gen_salt('bf', 10)) AS hash`,
  'CREATE TEMP TABLE existing_cases AS SELECT case_id FROM cases',
]
function insert(table, columns, rows, conflict = '') {
  if (rows.length) statements.push(`INSERT INTO ${table} (${columns}) VALUES\n${rows.map((row) => `(${row.map(sql).join(',')})`).join(',\n')}\nON CONFLICT ${conflict} DO NOTHING`)
}
function lookup(table, value, column) {
  return `(SELECT ${column} FROM ${table} WHERE name=${sql(value)})`
}
function linkCatalog(table, firstColumn, firstId, catalog, names) {
  const column = { directions: 'direction_id', technologies: 'technology_id', competencies: 'competency_id' }[catalog]
  const values = [...new Set(names.filter(Boolean))]
  insert(catalog, 'name', values.map((name) => [name]))
  for (const name of values) {
    statements.push(`INSERT INTO ${table} (${firstColumn},${column}) VALUES (${sql(firstId)},${lookup(catalog, name, column)}) ON CONFLICT DO NOTHING`)
  }
}

const roles = { admin: 'admin', curator: 'university_staff', university: 'university_staff', company: 'company_representative', student: 'student' }
const aliases = { admin: 'demo.admin', curator_1: 'demo.curator', company_25: 'demo.ibs', company_26: 'demo.inoseti', company_27: 'demo.ufanet', company_28: 'demo.action', company_30: 'demo.gazprom' }
const alphabet = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
const latin = 'a b v g d e e zh z i y k l m n o p r s t u f kh ts ch sh shch _ y _ e yu ya'.split(' ')
function companyLogin(name) {
  const slug = [...name.toLowerCase()].map((char) => latin[alphabet.indexOf(char)] ?? char).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 27)
  return `demo.${slug}`
}
function loginName(user) {
  const studentNumber = Number(user.id.match(/^syn_student_(\d+)$/)?.[1])
  if (studentNumber >= 1 && studentNumber <= 20) return `demo.student${studentNumber}`
  return aliases[user.username] ?? (user.companyProfile ? companyLogin(user.companyProfile.companyName) : user.username)
}
const users = read('users')
for (const user of users) {
  const userId = id(user.id)
  statements.push(`INSERT INTO users(user_id,username,email,group_name,password_hash,status,created_at)
    VALUES (${[userId, loginName(user), user.email, user.studentProfile?.group].map(sql).join(',')},
      (SELECT hash FROM import_password),${sql(user.isBlocked ? 'blocked' : 'active')},${sql(user.createdAt)})
    ON CONFLICT (user_id) DO NOTHING`)
  statements.push(`INSERT INTO user_roles(user_id,role_id) SELECT ${sql(userId)},role_id FROM roles WHERE code=${sql(roles[user.role])} ON CONFLICT DO NOTHING`)
  if (user.companyProfile && loginName(user) !== user.username) {
    statements.push(`UPDATE users SET username=${sql(loginName(user))}
      WHERE user_id=${sql(userId)} AND username=${sql(user.username)}`)
  }
}

const admin = id(users.find((user) => user.role === 'admin').id)
const students = read('students')
const studentDetails = new Map(read('student-details').map((detail) => [detail.studentId, detail]))
const educationLevels = { Бакалавриат: 'bachelor', Специалитет: 'specialist', Магистратура: 'master', Аспирантура: 'postgraduate' }
for (const student of students) {
  const profile = student.studentProfile
  const detail = studentDetails.get(student.id)
  const educationLevel = educationLevels[profile.educationLevel]
  const bio = detail ? [
    `${detail.specialization}. ${detail.city}.`,
    profile.bio,
    `В командной работе особенно интересны ${detail.desiredContribution}.`,
    `Цель на семестр — ${detail.learningGoals.charAt(0).toLowerCase() + detail.learningGoals.slice(1)}.`,
  ].join('\n\n') : profile.bio
  const [first, last, ...middle] = student.fullName.split(' ')
  const studentId = id(student.id)
  insert('students', 'user_id,first_name,last_name,patronymic,institute_name,study_direction,program_name,education_level,course,group_name,phone,bio,professional_interests,competencies,technologies,links,created_at', [[
    studentId, first, last, middle.join(' ') || null, profile.institute, profile.fieldOfStudy, profile.educationalProgram, educationLevel,
    profile.course, profile.group, profile.phone || null, bio, profile.interests, profile.skills, profile.techStack,
    profile.githubUrl ? [{ kind: 'github', url: profile.githubUrl }] : [], student.createdAt,
  ]])
  statements.push(`UPDATE students SET
    education_level=COALESCE(NULLIF(education_level,''),${sql(educationLevel)}),
    bio=CASE WHEN NULLIF(btrim(bio),'') IS NULL OR bio=${sql(profile.bio)} THEN ${sql(bio)} ELSE bio END
    WHERE user_id=${sql(studentId)} AND (NULLIF(education_level,'') IS NULL OR NULLIF(btrim(bio),'') IS NULL OR bio=${sql(profile.bio)})`)
  if (profile.curatorId) insert('student_curators', 'student_id,curator_id,assigned_by', [[studentId, id(profile.curatorId), admin]])
}
const companies = read('companies')
const officialPartners = read('partners')
const anchor = officialPartners[0]
if (existsSync(new URL(anchor.logo, import.meta.url))) {
  companies.push({
    id: 'syn_partner_gazprom_neft', name: anchor.name, shortName: 'Газпром нефть',
    industry: 'Нефтегазовая промышленность', description: 'Якорный индустриальный партнёр программы ТОП-ИТ Уфимского университета науки и технологий.',
    website: anchor.website, logo: anchor.logo, coverImage: 'assets/photos/office-open.jpg', isModerated: true,
  })
}
for (const partner of officialPartners.filter((item) => item.company)) {
  const company = companies.find((item) => item.id === partner.company)
  if (company && existsSync(new URL(partner.logo, import.meta.url))) company.logo = partner.logo
}
const universities = {
  syn_company_033: 'Уфимский университет науки и технологий',
  syn_company_034: 'Башкирский государственный педагогический университет им. М. Акмуллы',
}
for (const company of companies) {
  if (universities[company.id]) {
    company.name = universities[company.id]
    company.industry = 'Университет'
    statements.push(`UPDATE companies SET full_name=${sql(company.name)},industry='Университет' WHERE company_id=${sql(id(company.id))}`)
  }
}
insert('companies', 'company_id,full_name,short_name,industry,description,website,contacts,status', companies.map((company) => [
  id(company.id), company.name, company.shortName, company.industry, company.description, company.website || null,
  [company.contactPerson, company.email, company.phone].filter(Boolean).join('\n'), company.isModerated ? 'approved' : 'pending',
]))
for (const company of companies) {
  const { internshipProgram = '', practiceProgram = '' } = company
  if (internshipProgram || practiceProgram) {
    statements.push(`UPDATE companies SET
      internship_program=COALESCE(NULLIF(internship_program,''),${sql(internshipProgram)}),
      practice_program=COALESCE(NULLIF(practice_program,''),${sql(practiceProgram)})
      WHERE company_id=${sql(id(company.id))} AND (internship_program='' OR practice_program='')`)
  }
}
const companyOwners = new Map()
for (const user of users.filter((account) => account.role === 'company')) {
  const company = user.companyProfile
  companyOwners.set(company.companyId, id(user.id))
  insert('company_members', 'company_id,user_id,position,permissions', [[id(company.companyId), id(user.id), company.position, ['manage_company']]])
}

const companiesWithCases = new Set(companies.filter((company) => company.isModerated).map((company) => company.id))
const demoCases = demoCompanyCases.filter((item) => companiesWithCases.has(item.companyId))
const originalCases = [...read('cases'), ...demoCases]
const originalPrograms = read('programs')
const companyCoverage = companyDemoCoverage(
  companies.filter((company) => company.isModerated && companyOwners.has(company.id)),
  originalCases, [...originalPrograms, ...companyPrograms],
)
const cases = [...originalCases, ...companyCoverage.newCases]
const caseStatus = { open: 'published', selection: 'published', accepted: 'in_progress', submitted: 'in_progress', review: 'in_progress', archived: 'hidden' }
const workFormat = { дистанционный: 'remote', смешанный: 'hybrid', очный: 'onsite' }
const difficulty = { Начальный: 'beginner', Средний: 'intermediate', Высокий: 'advanced' }
const milestones = Map.groupBy(read('milestones'), (item) => item.caseId)
for (const item of cases) {
  const caseId = id(item.id)
  const owner = companyOwners.get(item.companyId) ?? admin
  const format = ['hackathon', 'olympiad'].includes(item.kind) ? item.kind : 'case'
  const terms = item.ipRightsDescription ?? item.ipRights ?? ''
  const due = item.deadlineDate
  const deadline = due && item.applicationDeadline > due ? null : item.applicationDeadline
  insert('cases', 'case_id,company_id,created_by,title,summary,full_brief,type,event_format,difficulty,work_format,participation_mode,admission_mode,team_size_min,team_size_max,application_deadline,due_at,duration,result_requirements,evaluation_rules,ip_terms,created_at,visibility', [[
    caseId, id(item.companyId), owner, item.title, item.shortDescription, item.fullDescription,
    { monetary: 'paid', contest: 'contest' }[item.rewardType] ?? 'educational', format, difficulty[item.complexity], workFormat[item.workFormat],
    item.participationFormat ?? 'both', format === 'case' ? 'selection' : 'open', item.teamSize?.min, item.teamSize?.max,
    deadline, due, item.duration, item.resultRequirements ?? '', item.evaluationOrder, terms, item.publishedAt ?? '2026-11-23', item.isConfidential ? 'restricted' : 'public',
  ]])
  insert('case_revisions', 'case_revision_id,case_id,version_no,brief_snapshot,ip_terms_snapshot,created_by', [[
    id(`${item.id}:revision`), caseId, 1, { title: item.title, summary: item.shortDescription, full_brief: item.fullDescription }, terms, owner,
  ]])
  linkCatalog('case_directions', 'case_id', caseId, 'directions', [item.direction])
  linkCatalog('case_technologies', 'case_id', caseId, 'technologies', item.recommendedTech ?? [])
  linkCatalog('case_competencies', 'case_id', caseId, 'competencies', item.requiredCompetencies ?? [])
  for (const [index, criterion] of (item.evaluationCriteria ?? []).entries()) {
    statements.push(`INSERT INTO evaluation_criteria(case_id,name,max_score,ordinal)
      SELECT ${sql(caseId)},${sql(criterion.label)},${sql(criterion.maxScore)},${index + 1}
      WHERE NOT EXISTS (SELECT 1 FROM existing_cases WHERE case_id=${sql(caseId)})`)
  }
  insert('case_stages', 'stage_id,case_id,ordinal,title,expected_result,due_at', (milestones.get(item.id) ?? []).map((stage) => [
    id(stage.id), caseId, stage.stepNumber, stage.title, stage.description, stage.deadline,
  ]), '(stage_id)')
  const status = caseStatus[item.status] ?? item.status
  if (['published', 'in_progress', 'completed'].includes(status)) {
    insert('case_moderation_events', 'case_moderation_event_id,case_id,case_revision_id,moderator_id,previous_status,new_status,decision', [[
      id(`${item.id}:approval`), caseId, id(`${item.id}:revision`), admin, 'moderation', 'published', 'approve',
    ]])
  }
  statements.push(`UPDATE cases SET status=${sql(status)} WHERE case_id=${sql(caseId)} AND NOT EXISTS (SELECT 1 FROM existing_cases WHERE case_id=${sql(caseId)})`)
}

const projects = [...read('projects'), ...read('demo-pet-projects')]
const activeDemoCases = demoCases.filter((item) => item.status === 'open')
const acceptedAt = '2026-11-24T09:30:00+05:00'
const submittedAt = '2026-11-24T12:00:00+05:00'
const evaluatedAt = '2026-11-24T14:00:00+05:00'
for (const item of activeDemoCases) {
  insert('case_stages', 'stage_id,case_id,ordinal,title,expected_result,due_at', [
    [id(`${item.id}:prototype`), id(item.id), 1, 'Промежуточная защита', 'Прототип основного сценария и один проверочный пример.', '2026-11-26'],
    [id(`${item.id}:delivery`), id(item.id), 2, 'Доработка и итоговая защита', 'Закрыть замечания наставника, подготовить инструкцию и итоговую демонстрацию.', item.deadlineDate],
  ], '(stage_id)')
}
for (const [index, student] of students.entries()) {
  const item = activeDemoCases[index % activeDemoCases.length]
  const key = `${item.id}:${student.id}:active`
  const studentId = id(student.id)
  const caseId = id(item.id)
  const revisionId = id(`${item.id}:revision`)
  const applicationId = id(`${key}:entry`)
  const executionId = id(`${key}:work`)
  const submissionId = id(`${key}:submission`)
  const stageId = id(`${item.id}:prototype`)
  const reviewer = companyOwners.get(item.companyId) ?? admin
  const score = 73 + index * 7 % 25
  const nextStep = [
    'На следующем этапе проверьте случай с пропущенными полями.',
    'На следующем этапе сравните выходные данные на двух наборах.',
    'На следующем этапе уточните инструкцию запуска и отметьте ограничения решения.',
  ][index % 3]
  const feedback = `Промежуточная оценка: ${score}/100. Основной сценарий принят. ${nextStep}`
  insert('applications', 'application_id,case_id,case_revision_id,submitted_by,student_id,status,entry_kind,submitted_at', [[
    applicationId, caseId, revisionId, studentId, studentId, 'accepted', 'registration', acceptedAt,
  ]])
  insert('application_consents', 'application_id,student_id,case_revision_id,accepted_at', [[applicationId, studentId, revisionId, acceptedAt]])
  insert('executions', 'execution_id,case_id,application_id,status,started_at,due_at,created_at', [[
    executionId, caseId, applicationId, 'in_progress', acceptedAt, item.deadlineDate, acceptedAt,
  ]])
  insert('execution_members', 'execution_id,student_id,joined_at', [[executionId, studentId, acceptedAt]])
  insert('execution_stages', 'execution_id,stage_id,status,feedback,completed_at', [
    [executionId, stageId, 'accepted', feedback, evaluatedAt],
    [executionId, id(`${item.id}:delivery`), 'in_progress', null, null],
  ])
  insert('submissions', 'submission_id,execution_id,stage_id,version_no,kind,title,description,status,submitted_by,submitted_at,reviewed_at', [[
    submissionId, executionId, stageId, 1, 'stage', `Промежуточный прототип: ${item.title}`,
    `${item.shortDescription} Подготовлен контрольный пример и описано текущее ограничение прототипа.`,
    'accepted', studentId, submittedAt, evaluatedAt,
  ]])
  insert('evaluations', 'evaluation_id,submission_id,evaluator_id,total_score,max_score,feedback,created_at,published_at', [[
    id(`${key}:assessment`), submissionId, reviewer, score, 100, feedback, evaluatedAt, evaluatedAt,
  ]])
  insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [[
    id(`${key}:notification`), studentId, 'submission_accepted', 'Опубликована промежуточная оценка',
    `«${item.title}». ${feedback}`, 'execution', executionId, evaluatedAt,
  ]])
}
const completedDemoCases = demoCases.filter((item) => item.status === 'completed')
const resultNominations = ['Качество реализации', 'Воспроизводимость решения', 'Лучший разбор сценария', 'Лучшая демонстрация']
const demoResults = new Map()
for (const [index, student] of students.entries()) {
  const item = completedDemoCases[index % completedDemoCases.length]
  const studentId = id(student.id)
  const key = `${item.id}:${student.id}`
  const caseId = id(item.id)
  const revisionId = id(`${item.id}:revision`)
  const applicationId = id(`${key}:entry`)
  const executionId = id(`${key}:work`)
  const submissionId = id(`${key}:submission`)
  const reviewer = companyOwners.get(item.companyId) ?? admin
  const nomination = resultNominations[Math.floor(index / completedDemoCases.length)]
  demoResults.set(student.id, { executionId, reviewer, date: item.deadlineDate })
  insert('applications', 'application_id,case_id,case_revision_id,submitted_by,student_id,status,entry_kind,submitted_at', [[
    applicationId, caseId, revisionId, studentId, studentId, 'accepted', item.kind === 'hackathon' ? 'registration' : 'application', item.publishedAt,
  ]])
  insert('application_consents', 'application_id,student_id,case_revision_id,accepted_at', [[applicationId, studentId, revisionId, item.publishedAt]])
  insert('executions', 'execution_id,case_id,application_id,status,started_at,ended_at,created_at', [[
    executionId, caseId, applicationId, 'done', item.publishedAt, item.deadlineDate, item.publishedAt,
  ]])
  insert('execution_members', 'execution_id,student_id,joined_at', [[executionId, studentId, item.publishedAt]])
  insert('submissions', 'submission_id,execution_id,version_no,title,description,status,submitted_by,submitted_at,reviewed_at', [[
    submissionId, executionId, 1, item.title, item.shortDescription, 'accepted', studentId, item.deadlineDate, item.deadlineDate,
  ]])
  insert('evaluations', 'evaluation_id,submission_id,evaluator_id,total_score,max_score,feedback,created_at,published_at', [[
    id(`${key}:assessment`), submissionId, reviewer, 75 + index * 11 % 23, 100,
    'Результат принят. Проверены основной сценарий, воспроизводимость и работа на тестовых данных.', item.deadlineDate, item.deadlineDate,
  ]])
  insert('awards', 'award_id,execution_id,title,place_no,awarded_by,awarded_at', [[
    id(`${key}:award`), executionId, `Демо · победитель номинации «${nomination}»`, 1, reviewer, item.deadlineDate,
  ]])
  const detail = studentDetails.get(student.id)
  statements.push(`INSERT INTO portfolio_settings(student_id,headline,about)
    SELECT s.user_id,${sql(detail?.specialization ?? student.studentProfile.educationalProgram)},s.bio FROM students s WHERE s.user_id=${sql(studentId)}
    ON CONFLICT(student_id) DO UPDATE SET
      headline=CASE WHEN portfolio_settings.headline IS NULL OR portfolio_settings.headline IN ('',${sql(student.studentProfile.educationalProgram)}) THEN EXCLUDED.headline ELSE portfolio_settings.headline END,
      about=CASE WHEN portfolio_settings.about IS NULL OR portfolio_settings.about IN ('',${sql(student.studentProfile.bio)}) THEN EXCLUDED.about ELSE portfolio_settings.about END
    WHERE portfolio_settings.headline IS NULL OR portfolio_settings.headline IN ('',${sql(student.studentProfile.educationalProgram)})
      OR portfolio_settings.about IS NULL OR portfolio_settings.about IN ('',${sql(student.studentProfile.bio)})`)
  insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [
    [id(`${key}:notice:accepted`), studentId, 'submission_accepted', 'Проект принят', `Работа «${item.title}» завершена. В кабинете доступна оценка.`, 'execution', executionId, item.deadlineDate],
    [id(`${key}:notice:award`), studentId, 'award', 'Опубликованы итоги конкурса', `В демонстрационном конкурсе отмечена номинация «${nomination}».`, 'execution', executionId, item.deadlineDate],
    [id(`${key}:notice:profile`), studentId, 'portfolio', 'Обновлено портфолио', 'Добавлены резюме и материалы учебных проектов.', null, null, '2026-11-24T10:30:00+05:00'],
  ])
}
for (const user of users.filter((item) => item.role !== 'student')) {
  const companyId = user.companyProfile?.companyId
  const item = demoCases.find((entry) => entry.companyId === companyId)
  insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [
    [id(`${user.id}:demo:registry`), id(user.id), 'showcase', 'Обновилась учебная витрина',
      item ? `В каталоге доступен учебный кейс «${item.title}».` : 'В каталоге подготовлены примеры работ и студенческие портфолио.',
      item ? 'case' : null, item ? id(item.id) : null, '2026-11-24T09:00:00+05:00'],
    [id(`${user.id}:demo:results`), id(user.id), 'showcase', 'Доступны итоги проектных работ',
      'В учебной витрине появились завершённые работы и оценки за проверенные решения.', null, null, '2026-11-24T11:00:00+05:00'],
  ])
}
const companyDemoDates = {
  applied: '2026-11-19T10:00:00+05:00',
  started: '2026-11-20T09:00:00+05:00',
  reviewed: '2026-11-23T16:00:00+05:00',
  finished: '2026-11-13T16:00:00+05:00',
}
for (const [index, item] of companyCoverage.newCases.entries()) {
  const caseId = id(item.id)
  const revisionId = id(`${item.id}:revision`)
  const owner = companyOwners.get(item.companyId)
  const candidates = Array.from({ length: 7 }, (_, offset) => students[(index * 7 + offset) % students.length])
  const closed = item.status === 'completed'
  const entryKind = item.kind === 'case' ? 'application' : 'registration'
  const applied = closed ? '2026-10-27T10:00:00+05:00' : companyDemoDates.applied
  const statuses = closed || item.status === 'in_progress'
    ? ['accepted', 'submitted', 'interview', 'rejected', 'info_requested']
    : item.kind === 'case' ? ['submitted', 'interview'] : ['accepted', 'accepted', 'accepted']
  const started = closed ? '2026-10-30T09:00:00+05:00' : companyDemoDates.started
  const reviewed = closed ? companyDemoDates.finished : companyDemoDates.reviewed
  for (const [position, status] of statuses.entries()) {
    const studentId = id(candidates[position].id)
    const applicationId = id(`${item.id}:application:${position}`)
    insert('applications', 'application_id,case_id,case_revision_id,submitted_by,student_id,status,entry_kind,submitted_at,cover_letter,company_notes', [[
      applicationId, caseId, revisionId, studentId, studentId, status, entryKind, applied,
      `Хочу показать учебный подход к задаче «${item.title}». Начну с проверочного примера из портфолио.`,
      ({ interview: 'На встрече обсудим один проект из портфолио.', rejected: 'В этом наборе выбраны кандидаты с опытом по профилю задачи.', info_requested: 'Добавьте ссылку на пример работы и укажите свой вклад.' })[status],
    ]])
    if (status === 'accepted') insert('application_consents', 'application_id,student_id,case_revision_id,accepted_at', [[applicationId, studentId, revisionId, applied]])
  }
  insert('case_views', 'case_id,user_id,created_at', candidates.map((student) => [caseId, id(student.id), applied]))
  if (item.status === 'open') {
    if (item.rewardType === 'contest') {
      const rewardId = id(`${item.id}:prize`)
      insert('case_rewards', 'case_reward_id,case_id,kind,description', [[rewardId, caseId, 'certificate', 'Демонстрационный диплом по результатам защиты']])
    }
    continue
  }
  const active = !closed
  const executionId = id(`${item.id}:workspace`)
  const studentId = id(candidates[0].id)
  const score = 78 + (index * 7 % 19)
  const stage = id(`${item.id}:prototype`)
  const delivery = id(`${item.id}:delivery`)
  const submissionId = id(`${item.id}:submission`)
  const feedback = active
    ? `Промежуточная оценка: ${score}/100. Проверка принята. К защите добавьте пример с неполным входом.`
    : `Итоговая оценка: ${score}/100. Результат принят, инструкция повторного запуска проверена.`
  if (active) {
    insert('case_stages', 'stage_id,case_id,ordinal,title,expected_result,due_at', [
      [stage, caseId, 1, 'Проверка прототипа', 'Результат контрольного прогона и краткая инструкция.', '2026-11-23'],
      [delivery, caseId, 2, 'Итоговая защита', 'Исправления, итоговый отчёт и демонстрация.', item.deadlineDate],
    ], '(stage_id)')
    insert('case_rewards', 'case_reward_id,case_id,kind,description,amount,currency', [[
      id(`${item.id}:reward`), caseId, 'money', 'Учебный пример вознаграждения за принятый результат', 5000 + (index % 4) * 1000, 'RUB',
    ]])
  }
  insert('executions', 'execution_id,case_id,application_id,status,started_at,due_at,ended_at,created_at', [[
    executionId, caseId, id(`${item.id}:application:0`), closed ? 'done' : 'in_progress',
    started, item.deadlineDate, closed ? reviewed : null, started,
  ]])
  insert('execution_members', 'execution_id,student_id,joined_at', [[executionId, studentId, started]])
  insert('execution_mentors', 'execution_id,user_id,role_name,assigned_at', [[executionId, owner, 'Наставник от организации', started]])
  if (active) {
    insert('execution_stages', 'execution_id,stage_id,status,feedback,completed_at', [
      [executionId, stage, 'accepted', feedback, reviewed],
      [executionId, delivery, 'in_progress', null, null],
    ])
    insert('execution_comments', 'comment_id,execution_id,stage_id,author_id,body,created_at', [[
      id(`${item.id}:mentor-note`), executionId, stage, owner, feedback, reviewed,
    ]])
  }
  insert('submissions', 'submission_id,execution_id,stage_id,version_no,kind,title,description,status,submitted_by,submitted_at,reviewed_at', [[
    submissionId, executionId, active ? stage : null, 1, active ? 'stage' : 'final',
    active ? 'Демонстрация прототипа' : 'Итоговый результат', item.shortDescription, 'accepted', studentId, reviewed, reviewed,
  ]])
  insert('evaluations', 'evaluation_id,submission_id,evaluator_id,total_score,max_score,feedback,created_at,published_at', [[
    id(`${item.id}:evaluation`), submissionId, owner, score, 100, feedback, reviewed, reviewed,
  ]])
  insert('reviews', 'review_id,submission_id,author_id,decision,body,created_at', [[
    id(`${item.id}:review`), submissionId, owner, 'accept', feedback, reviewed,
  ]])
  if (closed) insert('awards', 'award_id,execution_id,title,place_no,awarded_by,awarded_at', [[
    id(`${item.id}:award`), executionId, 'Демо · лучшая защита проекта', 1, owner, reviewed,
  ]])
  insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [[
    id(`${item.id}:company-notice`), owner, 'showcase', 'Кейс обновлён',
    `«${item.title}»: опубликован отзыв наставника и обновилась очередь заявок.`, 'case', caseId, reviewed,
  ]])
}
const categories = { учебный: 'coursework', курсовой: 'coursework', 'ВКР': 'coursework', 'pet-проект': 'pet_project', стартап: 'startup', 'НИР': 'research', хакатон: 'hackathon' }
for (const project of projects) {
  const projectId = id(project.id)
  const status = project.status === 'архив' ? 'archived' : project.moderationStatus === 'pending' ? 'moderation' : 'published'
  const createdAt = earlyProjectDates[project.id] ?? project.createdAt
  insert('student_projects', 'project_id,owner_id,title,category,short_description,full_description,problem_solved,github_url,product_url,visibility,status,created_at,published_at', [[
    projectId, id(project.authorId), project.title, categories[project.category] ?? 'other', project.shortDescription, project.fullDescription,
    project.problemSolved, project.githubUrl || null, project.productUrl || null, project.visibility, status, createdAt,
    status === 'published' ? createdAt : null,
  ]])
  if (createdAt !== project.createdAt) {
    statements.push(`UPDATE student_projects SET created_at=${sql(createdAt)},
      published_at=CASE WHEN published_at=${sql(project.createdAt)} THEN ${sql(createdAt)}::timestamptz ELSE published_at END
      WHERE project_id=${sql(projectId)} AND created_at=${sql(project.createdAt)}`)
  }
  linkCatalog('student_project_directions', 'project_id', projectId, 'directions', [project.direction])
  linkCatalog('student_project_technologies', 'project_id', projectId, 'technologies', project.technologies)
  insert('project_members', 'project_id,student_id,role_name,joined_at', [[projectId, id(project.authorId), 'Автор', createdAt]])
}

const visibleProjects = projects.filter((project) =>
  project.visibility === 'public' && project.status !== 'архив' && project.moderationStatus !== 'pending')
const activityStudents = students.filter((student) => !student.isBlocked)
for (const [index, project] of visibleProjects.entries()) {
  const actors = activityStudents.filter((student) => student.id !== project.authorId)
  const start = index * 7 % actors.length
  const readers = [...actors.slice(start), ...actors.slice(0, start)]
  insert('student_project_likes', 'project_id,user_id,created_at', readers.slice(0, index < 8 ? 9 + (index * 5 % 16) : 2 + (index * 3 % 9))
    .map((reader) => [id(project.id), id(reader.id), '2026-11-23T19:00:00Z']))
  if (index >= 18) continue
  insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [[
    id(`${project.id}:discussion-notice`), id(project.authorId), 'comment',
    'Новый комментарий к проекту', `В обсуждении «${project.title}» появился вопрос к автору.`,
    'student_project', id(project.id), '2026-11-16T14:00:00Z',
  ]])
  const [question, answer] = reviews[index % reviews.length]
  const rows = [
    [id(`${project.id}:discussion`), 'student_project', id(project.id), null, id(readers[0].id), question, '2026-11-16T14:00:00Z'],
    [id(`${project.id}:reply`), 'student_project', id(project.id), id(`${project.id}:discussion`), id(project.authorId), answer, '2026-11-18T11:30:00Z'],
  ]
  if (index < 8) rows.push(
    [id(`${project.id}:review`), 'student_project', id(project.id), null, id(readers[1].id), `Посмотрел «${project.title}». Хорошо бы приложить небольшой пример входных данных для повторной проверки.`, '2026-11-21T10:00:00Z'],
    [id(`${project.id}:follow-up`), 'student_project', id(project.id), null, id(readers[2].id), 'На следующем показе интересно сравнить результаты с первой версией.', '2026-11-23T09:00:00Z'],
  )
  for (const row of rows) insert('comments', 'comment_id,resource_type,resource_id,parent_comment_id,author_id,body,created_at', [row])
}
insert('feedback_messages', 'feedback_id,author_id,body,created_at', feedback.map((body, index) =>
  [id(`demo-feedback:${index}`), id(activityStudents[index * 3].id), body, `2026-11-${12 + index * 2}T15:30:00Z`]))

const prizeCase = cases.find((item) => item.companyId === 'syn_company_001' && item.isModerated && item.status === 'in_progress')
if (prizeCase) {
  const rewardId = id('demo-semester-prize:2026-fall')
  insert('case_rewards', 'case_reward_id,case_id,kind,description,currency,prize_fund', [[
    rewardId, id(prizeCase.id), 'prize', 'Демонстрационный призовой фонд осеннего семестра 2026', 'RUB', semesterFund,
  ]])
  insert('prize_places', 'prize_place_id,case_reward_id,place_no,amount', [75000, 50000, 25000].map((amount, index) =>
    [id(`demo-semester-prize:${index + 1}`), rewardId, index + 1, amount]))
}

const addedPrograms = [...companyPrograms, ...companyCoverage.newPrograms]
  .filter((program) => companyOwners.has(program.company_id) && companiesWithCases.has(program.company_id))
const programs = [...originalPrograms, ...addedPrograms]
for (const program of addedPrograms) {
  const company = companies.find((item) => item.id === program.company_id)
  const practice = program.kind === 'practice'
  const column = practice ? 'practice_program' : 'internship_program'
  const original = practice ? company.practiceProgram : company.internshipProgram
  const description = `## ${program.title}\n\n${program.content_markdown}`
  statements.push(`UPDATE companies SET ${column}=${sql(description)}
    WHERE company_id=${sql(id(company.id))}
      AND (${column}='' OR ${column}=${sql(original)})`)
}
insert('internship_programs', 'program_id,company_id,created_by,title,kind,summary,content_markdown,capacity,application_deadline,status,published_at', programs.map((program) => [
  id(program.program_id), id(program.company_id), companyOwners.get(program.company_id), program.title, program.kind, program.summary,
  program.content_markdown, program.capacity, program.application_deadline, program.status, program.status === 'published' ? '2026-11-23' : null,
]))
insert('internship_applications', 'application_id,program_id,student_id,cover_letter,status,created_at', read('opportunity-applications').map((item) => [
  id(item.application_id), id(item.program_id), id(item.student_id), item.cover_letter, item.status, item.created_at,
]))
const activityDate = '2026-11-24T10:00:00+05:00'
const appliedDate = '2026-11-24T11:00:00+05:00'
const decidedDate = '2026-11-24T13:30:00+05:00'
for (const [index, program] of addedPrograms.entries()) {
  const matching = (student) => program.skills.filter((skill) =>
    student.studentProfile.techStack.some((technology) => technology.toLowerCase() === skill.toLowerCase())).length
  const offset = index * 7 % activityStudents.length
  const candidates = [...activityStudents.slice(offset), ...activityStudents.slice(0, offset)]
    .map((student) => ({ student, relevance: matching(student) }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 2 + index % 5)
  const programId = id(program.program_id)
  const programOwner = companyOwners.get(program.company_id)
  for (const [position, { student, relevance }] of candidates.entries()) {
    const key = `${program.program_id}:${student.id}`
    const studentId = id(student.id)
    const status = position === 0 && index % 3 === 0 ? 'accepted' : position === 1 && index % 5 === 0 ? 'rejected' : 'submitted'
    const resume = `(SELECT file_id FROM student_profile_files WHERE student_id=${sql(studentId)} AND kind='resume' AND is_default AND detached_at IS NULL)`
    const background = student.studentProfile.techStack.slice(0, 3).join(', ')
    const letter = [
      `Хочу поработать над задачей «${program.title}». Мой учебный стек: ${background}.`,
      relevance ? 'Могу показать учебный проект на собеседовании и объяснить, какие сценарии удалось проверить.' : 'Готов начать с контрольного примера и разобрать недостающий инструмент с наставником.',
    ].join(' ')
    statements.push(`INSERT INTO internship_applications(application_id,program_id,student_id,cover_letter,resume_file_id,status,created_at,decided_at)
      VALUES (${[id(key), programId, studentId, letter].map(sql).join(',')},${resume},${[status, appliedDate, status === 'submitted' ? null : decidedDate].map(sql).join(',')}) ON CONFLICT DO NOTHING`)
    if (status !== 'submitted') insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [[
      id(`${key}:decision`), studentId, 'opportunity_application', status === 'accepted' ? 'Отклик принят' : 'Рассмотрение отклика завершено',
      status === 'accepted' ? `В демопрограмме «${program.title}» согласован следующий этап.` : `Набор по программе «${program.title}» продолжится с другими кандидатами.`,
      'internship_program', programId, decidedDate,
    ]])
  }
  insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [[
    id(`${program.program_id}:inbox`), programOwner, 'opportunity_application', 'Новые отклики на программу',
    `По программе «${program.title}» есть отклики студентов. Резюме можно открыть в списке заявок.`,
    'internship_program', programId, appliedDate,
  ]])
}
for (const team of read('teams')) {
  insert('teams', 'team_id,name,leader_id,description,created_at', [[id(team.id), team.name, id(team.leaderId), team.description, team.createdAt]])
  insert('team_members', 'team_id,student_id,joined_at', team.members.map((member) => [id(team.id), id(member.id), team.createdAt]))
}
const applicationStatus = { pending: 'submitted', need_info: 'info_requested' }
insert('applications', 'application_id,case_id,case_revision_id,submitted_by,student_id,team_id,status,cover_letter,github_url,company_notes,submitted_at', read('applications').map((item) => [
  id(item.id), id(item.caseId), id(`${item.caseId}:revision`), id(item.studentId), item.teamId ? null : id(item.studentId), id(item.teamId),
  applicationStatus[item.status] ?? item.status, item.coverLetter, item.githubUrl || null, item.companyNotes || null, item.createdAt,
]))
const newCompanyComments = []
const publicCases = cases.filter((item) => !item.isConfidential &&
  ['open', 'selection', 'accepted', 'submitted', 'review', 'published', 'in_progress', 'completed'].includes(item.status))
for (const [index, user] of users.filter((item) => item.companyProfile && !item.isBlocked).entries()) {
  const companyId = user.companyProfile.companyId
  const ownedCases = publicCases.filter((item) => item.companyId === companyId)
  const opportunities = addedPrograms.filter((program) => program.company_id === companyId)
  const relatedCase = ownedCases.find((item) => ['open', 'selection', 'published', 'in_progress'].includes(item.status))
  const candidate = activityStudents[(index * 3 + 1) % activityStudents.length]
  const recipient = id(candidate.id)
  const ownerId = id(user.id)
  if (opportunities.length || relatedCase) {
    const invitation = id(`${companyId}:demo-interview`)
    const program = opportunities[0]
    const status = index % 4 === 0 ? 'accepted' : index % 7 === 0 ? 'declined' : 'sent'
    insert('company_invitations', 'company_invitation_id,company_id,student_id,case_id,kind,status,message,sent_by,sent_at,responded_at', [[
      invitation, id(companyId), recipient, program ? null : id(relatedCase.id), 'interview', status,
      `Приглашаем на учебное собеседование по теме «${program?.title ?? relatedCase.title}». Подготовьте один пример работы из портфолио и расскажите о своём вкладе.`,
      ownerId, activityDate, status === 'sent' ? null : decidedDate,
    ]])
    insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [
      [id(`${companyId}:demo-interview:received`), recipient, 'company_invitation', 'Приглашение на учебное собеседование',
        `Получено приглашение от «${user.companyProfile.companyName}».`, 'company_invitation', invitation, activityDate],
      [id(`${companyId}:demo-interview:sent`), ownerId, 'company_invitation', 'Приглашение студенту',
        status === 'sent' ? `Приглашение отправлено. Кандидат: ${candidate.fullName}.` : `Получен ответ на приглашение. Кандидат: ${candidate.fullName}.`,
        'company_invitation', invitation, status === 'sent' ? activityDate : decidedDate],
    ])
  }
  for (const [position, item] of ownedCases.slice(0, index % 3 === 0 ? 3 : 2).entries()) {
    const author = activityStudents[(index * 7 + position * 5) % activityStudents.length]
    const key = `${item.id}:demo-company-discussion`
    const [question, answer] = companyQuestions[(index + position) % companyQuestions.length]
    const closed = item.status === 'completed'
    const content = closed ? 'Как команда проверила итоговый результат и что можно повторить самостоятельно?' : question
    const response = closed ? `В описании кейса сохранён итог работы: ${item.shortDescription} Для самостоятельной проверки начните с одного контрольного сценария.` : answer
    newCompanyComments.push(
      { id: key, caseId: item.id, authorId: author.id, content, createdAt: activityDate },
      { id: `${key}:reply`, caseId: item.id, authorId: user.id, parentId: key, content: response, createdAt: decidedDate },
    )
    insert('notifications', 'notification_id,user_id,type,title,body,resource_type,resource_id,created_at', [[
      id(`${key}:notification`), ownerId, 'comment', 'Вопрос по кейсу',
      `Студент оставил комментарий к кейсу «${item.title}».`, 'case', id(item.id), activityDate,
    ]])
  }
}
const comments = [...read('comments'), ...newCompanyComments]
  .sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)))
for (const item of comments) {
  const caseId = id(item.caseId)
  const parentId = id(item.parentId)
  statements.push(`INSERT INTO comments(comment_id,resource_type,resource_id,parent_comment_id,author_id,body,created_at)
    SELECT ${sql(id(item.id))},'case',case_id,${sql(parentId)},${sql(id(item.authorId))},${sql(item.content)},${sql(item.createdAt)}
    FROM cases WHERE case_id=${sql(caseId)} AND status IN ('published','in_progress','completed') AND visibility='public'
    ${parentId ? `AND EXISTS (SELECT 1 FROM comments WHERE comment_id=${sql(parentId)})` : ''}
    ON CONFLICT (comment_id) DO UPDATE SET parent_comment_id=EXCLUDED.parent_comment_id
    WHERE comments.parent_comment_id IS DISTINCT FROM EXCLUDED.parent_comment_id`)
}

function stageIds(table, column, keys) {
  statements.push(`CREATE TEMP TABLE ${table} (${column} uuid PRIMARY KEY)`)
  insert(table, column, keys.map((key) => [id(key)]))
}
stageIds('imported_student_ids', 'user_id', activityStudents.map((student) => student.id))
stageIds('imported_case_ids', 'case_id', cases.map((item) => item.id))
stageIds('imported_project_ids', 'project_id', projects.map((project) => project.id))
stageIds('imported_program_ids', 'program_id', programs.map((program) => program.program_id))
statements.push(readFileSync(new URL('fill-empty-engagement.sql', import.meta.url), 'utf8'), 'COMMIT')
const compose = ['compose', '--project-directory', root, '-f', `${root}/compose.demo.yaml`]
function docker(args, input) {
  const result = spawnSync('docker', [...compose, ...args], { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] })
  if (result.status !== 0 || result.error) throw new Error(`Docker Compose ${args[0]} failed. Check the output above.`, { cause: result.error })
  return result.stdout.trim()
}
function query(input) {
  return docker(['exec', '-T', 'postgres', 'env', 'PGCLIENTENCODING=UTF8', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'showcase_demo', '-d', 'showcase_demo'], input)
}
query(`${statements.join(';\n')};\n`)
console.log(`Imported showcase-data: ${users.length} accounts, ${companies.length} companies, ${cases.length} cases, ${projects.length} projects, ${programs.length} programs.`)

const mapping = docker(['port', 'api', '3005'])
if (!/^127\.0\.0\.1:\d+$/.test(mapping)) throw new Error('The demo API must use a loopback port.')
const api = `http://${mapping}/api/v1`
async function request(route, options) {
  const response = await fetch(`${api}${route}`, { ...options, signal: AbortSignal.timeout(45000) })
  if (!response.ok) throw new Error(`${options?.method ?? 'GET'} ${route}: HTTP ${response.status}`)
  return response.json()
}
async function tokenFor(login) {
  const session = await request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }),
  })
  return session.access_token
}
async function upload(route, method, token, path, bytes, filename = basename(path)) {
  const form = new FormData()
  form.append('file', new Blob([bytes]), filename)
  return request(route, { method, headers: { Authorization: `Bearer ${token}` }, body: form })
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const media = (path) => readFileSync(new URL(path, import.meta.url))
const studentPhotos = new Map(query(`SELECT s.user_id,f.checksum_sha256 FROM showcase.students s
  JOIN showcase.users u USING(user_id) JOIN showcase.files f ON f.file_id=COALESCE(u.avatar_file_id,s.photo_file_id)
  WHERE f.status='active';`).split(/\r?\n/).filter(Boolean).map((line) => line.split('|')))
const companyLogos = new Map(query(`SELECT c.company_id,f.checksum_sha256 FROM showcase.companies c
  JOIN showcase.files f ON f.file_id=c.logo_file_id WHERE f.status='active';`).split(/\r?\n/).filter(Boolean).map((line) => line.split('|')))
const formatId = (value) => value.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5')

const temp = mkdtempSync(join(tmpdir(), 'showcase-media-'))
try {
  const presentation = { companies: {}, representatives: {} }
  for (const company of companies) {
    const companyId = formatId(id(company.id))
    const filename = `${companyId}${extname(company.coverImage)}`
    copyFileSync(new URL(company.coverImage, import.meta.url), join(temp, filename))
    presentation.companies[companyId] = { name: company.shortName || company.name, cover: `/showcase-media/${filename}` }
  }
  for (const user of users.filter((item) => item.role !== 'student')) {
    presentation.representatives[formatId(id(user.id))] = user.companyProfile
      ? `${user.fullName} · ${user.companyProfile.companyName}`
      : user.fullName
  }
  writeFileSync(join(temp, 'catalog.json'), JSON.stringify(presentation))
  docker(['exec', '-T', 'frontend', 'mkdir', '-p', '/usr/share/nginx/html/showcase-media'])
  docker(['cp', `${temp}/.`, 'frontend:/usr/share/nginx/html/showcase-media'])
} finally {
  // Only the temporary directory created by mkdtempSync above is removed.
  rmSync(temp, { recursive: true, force: true })
}

const assets = []
let adminToken
const studentSessions = new Map()
function studentToken(student) {
  if (!studentSessions.has(student.id)) studentSessions.set(student.id, tokenFor(loginName(student)))
  return studentSessions.get(student.id)
}
// Reuse any successfully uploaded asset when retrying an interrupted import.
const existingFiles = new Map(query(`SELECT uploaded_by,checksum_sha256,file_id FROM showcase.files
  WHERE status='active' ORDER BY created_at DESC;`).split(/\r?\n/).filter(Boolean).map((line) => {
  const [owner, hash, fileId] = line.split('|')
  return [`${owner}:${hash}`, fileId]
}))
async function studentAsset(student, path, filename) {
  const bytes = media(path)
  const key = `${formatId(id(student.id))}:${digest(bytes)}`
  if (!existingFiles.has(key)) {
    existingFiles.set(key, studentToken(student).then((token) => upload('/files', 'POST', token, path, bytes, filename))
      .then((file) => file.file_id))
  }
  return existingFiles.get(key)
}
const mediaChanges = []
const accountsWithAvatars = new Set(query(`SELECT u.user_id FROM showcase.users u
  JOIN showcase.files f ON f.file_id=u.avatar_file_id WHERE f.status='active';`).split(/\r?\n/))
for (const user of users.filter((item) => item.role !== 'student' && !item.isBlocked)) {
  const userId = formatId(id(user.id))
  if (accountsWithAvatars.has(userId)) continue
  const company = companies.find((item) => item.id === user.companyProfile?.companyId)
  const logo = company && `assets/company-avatars/${company.id}.png`
  const path = [logo, company?.logo, user.avatar].find((asset) => asset && existsSync(new URL(asset, import.meta.url)))
  if (!path) throw new Error(`Missing account avatar for ${loginName(user)}`)
  assets.push(async () => {
    const file = await studentAsset(user, path)
    mediaChanges.push(`UPDATE showcase.users SET avatar_file_id=${sql(file)} WHERE user_id=${sql(userId)}
      AND NOT EXISTS (SELECT 1 FROM showcase.files f WHERE f.file_id=avatar_file_id AND f.status='active')`)
  })
}
const configuredCovers = new Map(query(`SELECT p.project_id,f.checksum_sha256 FROM showcase.student_projects p
  JOIN showcase.files f ON f.file_id=p.cover_file_id WHERE f.status='active';`).split(/\r?\n/).filter(Boolean).map((line) => line.split('|')))
const configuredScreenshots = new Set(query(`SELECT project_id || ':' || ordinal FROM showcase.student_project_files WHERE kind='screenshot';`).split(/\r?\n/))
for (const project of projects) {
  const owner = activityStudents.find((student) => student.id === project.authorId)
  if (!owner) continue
  const projectId = formatId(id(project.id))
  const illustratedPet = project.category === 'pet-проект'
  const illustration = `assets/pet-media/${project.id}`
  const coverPath = illustratedPet ? `${illustration}-cover.png` : project.coverImage
  const oldCoverHash = project.coverImage && digest(media(project.coverImage))
  const currentCoverHash = configuredCovers.get(projectId)
  const missingCover = !currentCoverHash || (illustratedPet && oldCoverHash && currentCoverHash === oldCoverHash)
  const gallery = [...(project.screenshots ?? [])]
  if (illustratedPet) gallery.push(`${illustration}-view-1.png`, `${illustration}-view-2.png`)
  const seen = new Set([digest(media(coverPath))])
  const screenshots = gallery.entries()
  const uniqueScreenshots = [...screenshots].filter(([, path]) => {
    const hash = digest(media(path))
    if (seen.has(hash)) return false
    seen.add(hash)
    return true
  })
  const missingScreenshots = uniqueScreenshots.filter(([index]) => !configuredScreenshots.has(`${projectId}:${index + 1}`))
  if (!missingCover && !missingScreenshots.length) continue
  assets.push(async () => {
    if (missingCover) {
      const cover = await studentAsset(owner, coverPath)
      mediaChanges.push(`UPDATE showcase.student_projects SET cover_file_id=${sql(cover)} WHERE project_id=${sql(projectId)}
        AND (cover_file_id IS NULL OR EXISTS (SELECT 1 FROM showcase.files f WHERE f.file_id=cover_file_id
          AND (f.status<>'active' OR f.checksum_sha256=${sql(currentCoverHash)})))`)
    }
    for (const [index, screenshot] of missingScreenshots) {
      const file = await studentAsset(owner, screenshot)
      mediaChanges.push(`INSERT INTO showcase.student_project_files(project_id,file_id,kind,ordinal)
        VALUES (${sql(projectId)},${sql(file)},'screenshot',${index + 1}) ON CONFLICT DO NOTHING`)
    }
  })
}
const resumesAttached = new Set(query(`SELECT student_id FROM showcase.student_profile_files WHERE kind='resume' AND is_default AND detached_at IS NULL;`).split(/\r?\n/))
const certificatesIssued = new Set(query(`SELECT execution_id FROM showcase.certificates WHERE revoked_at IS NULL;`).split(/\r?\n/))
for (const student of activityStudents) {
  const result = demoResults.get(student.id)
  const studentId = formatId(id(student.id))
  const needsResume = !resumesAttached.has(studentId)
  const needsCertificate = !certificatesIssued.has(formatId(result.executionId))
  if (!needsResume && !needsCertificate) continue
  assets.push(async () => {
    if (needsResume) {
      const resume = await studentAsset(student, `documents/resumes/${student.id}.pdf`, `Резюме — ${student.fullName}.pdf`)
      mediaChanges.push(`INSERT INTO showcase.student_profile_files(student_id,file_id,kind,visibility,is_default)
        VALUES (${sql(studentId)},${sql(resume)},'resume','public',true) ON CONFLICT DO NOTHING`)
    }
    if (needsCertificate) {
      const file = await studentAsset(student, `assets/demo-certificates/${student.id}.png`, 'Сертификат проектной работы — демо.png')
      mediaChanges.push(`INSERT INTO showcase.student_profile_files(student_id,file_id,kind,visibility)
        VALUES (${sql(studentId)},${sql(file)},'certificate','public') ON CONFLICT DO NOTHING`)
      mediaChanges.push(`INSERT INTO showcase.certificates(execution_id,student_id,file_id,verification_code,issued_by,issued_at)
        VALUES (${sql(result.executionId)},${sql(studentId)},${sql(file)},${sql(`DEMO-${student.id}`)},${sql(result.reviewer)},${sql(result.date)}) ON CONFLICT DO NOTHING`)
    }
  })
}
for (const milestone of demoAchievements) {
  const number = String(milestone.student).padStart(3, '0')
  const student = activityStudents.find((item) => item.id === `syn_student_${number}`)
  if (!student) continue
  assets.push(async () => {
    const path = `assets/achievements/student-${number}.png`
    const file = await studentAsset(student, path, `${milestone.title.replaceAll('«', '').replaceAll('»', '')} — демо.png`)
    const token = await studentToken(student)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const portfolio = await request('/portfolio/me/files', { headers })
    if (!portfolio.items?.some((item) => item.file_id === file)) {
      await request('/portfolio/me/files', {
        method: 'POST', headers, body: JSON.stringify({ file_id: file, kind: 'certificate', visibility: 'public', is_default: false }),
      })
    }
  })
}
for (const company of companies) {
  const companyId = formatId(id(company.id))
  const avatar = `assets/company-avatars/${company.id}.png`
  const path = existsSync(new URL(avatar, import.meta.url)) ? avatar : company.logo
  const bytes = media(path)
  if (companyLogos.get(companyId) === digest(bytes)) continue
  assets.push(async () => {
    adminToken ??= tokenFor('demo.admin')
    const file = await upload('/files', 'POST', await adminToken, path, bytes)
    mediaChanges.push(`UPDATE showcase.companies SET logo_file_id=${sql(file.file_id)} WHERE company_id=${sql(companyId)}`)
  })
}
for (const student of students.filter((item) => !item.isBlocked)) {
  const bytes = media(student.avatar)
  if (studentPhotos.get(formatId(id(student.id))) === digest(bytes)) continue
  assets.push(async () => {
    const token = await tokenFor(loginName(student))
    await upload('/users/me/photo', 'PUT', token, student.avatar, bytes)
  })
}
const failures = []
for (let index = 0; index < assets.length; index += 8) {
  const results = await Promise.allSettled(assets.slice(index, index + 8).map((run) => run()))
  for (const result of results) if (result.status === 'rejected') failures.push(result.reason)
}
const petIds = projects.filter((project) => project.category === 'pet-проект').map((project) => sql(id(project.id)))
if (petIds.length) {
  mediaChanges.push(`WITH duplicates AS (
    SELECT a.project_id,a.file_id, f.checksum_sha256=cover.checksum_sha256 AS matches_cover,
      row_number() OVER (PARTITION BY a.project_id,f.checksum_sha256 ORDER BY a.ordinal,a.file_id) AS copy
    FROM showcase.student_project_files a JOIN showcase.files f USING(file_id)
    JOIN showcase.student_projects p USING(project_id)
    LEFT JOIN showcase.files cover ON cover.file_id=p.cover_file_id
    WHERE a.kind='screenshot' AND a.project_id IN (${petIds.join(',')})
  )
  DELETE FROM showcase.student_project_files a USING duplicates d
  WHERE (a.project_id,a.file_id)=(d.project_id,d.file_id) AND (d.matches_cover OR d.copy>1)`)
}
if (programs.length) {
  const programIds = programs.map((program) => sql(id(program.program_id))).join(',')
  mediaChanges.push(`UPDATE showcase.internship_applications a SET resume_file_id=p.file_id
    FROM showcase.student_profile_files p
    WHERE a.program_id IN (${programIds}) AND a.resume_file_id IS NULL
      AND p.student_id=a.student_id AND p.kind='resume' AND p.is_default AND p.detached_at IS NULL`)
}
if (companyCoverage.newCases.length) {
  const caseIds = companyCoverage.newCases.map((item) => sql(id(item.id))).join(',')
  mediaChanges.push(`UPDATE showcase.applications a SET resume_file_id=p.file_id
    FROM showcase.student_profile_files p
    WHERE a.case_id IN (${caseIds}) AND a.resume_file_id IS NULL
      AND p.student_id=a.student_id AND p.kind='resume' AND p.is_default AND p.detached_at IS NULL`)
}
if (mediaChanges.length) query(`BEGIN;\n${mediaChanges.join(';\n')};\nCOMMIT;`)
if (failures.length) throw new AggregateError(failures, 'Some demo media uploads failed')
console.log(`Finished ${assets.length} media tasks and published ${companies.length} company covers.`)
