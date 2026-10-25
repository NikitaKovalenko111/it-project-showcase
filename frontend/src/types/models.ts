export type UserRole = 'admin' | 'university' | 'company' | 'student' | 'curator'
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'revision' | 'hidden'

export interface StudentProfile {
  university: string
  institute: string
  fieldOfStudy: string
  educationalProgram: string
  course: number
  group: string
  bio: string
  interests: string[]
  skills: string[]
  techStack: string[]
  githubUrl: string
  gitlabUrl?: string
  portfolioUrl?: string
  phone: string
  rating: number
  verifiedProjectsCount: number
  winsCount: number
}

export interface CompanyProfile {
  companyId: string
  companyName: string
  position: string
}

export interface User {
  id: string
  username: string
  fullName: string
  email: string
  role: UserRole
  avatar?: string
  phone?: string
  studentProfile?: StudentProfile
  companyProfile?: CompanyProfile
  isBlocked?: boolean
  createdAt: string
}

export interface Company {
  id: string
  name: string
  shortName: string
  logo: string
  description: string
  industry: string
  website: string
  email: string
  phone: string
  contactPerson: string
  directions: string[]
  activeCasesCount: number
  completedProjectsCount: number
  techStack: string[]
  isVerified: boolean
  isModerated: boolean
}

export type ProjectDirection =
  | 'Backend'
  | 'Frontend'
  | 'Fullstack'
  | 'Мобильная разработка'
  | 'Искусственный интеллект'
  | 'Машинное обучение'
  | 'Data Science'
  | 'Big Data'
  | 'DevOps'
  | 'Информационная безопасность'
  | 'Робототехника'
  | 'Компьютерное зрение'
  | 'Системное программирование'
  | 'Базы данных'
  | 'Тестирование'
  | 'UX/UI'
  | 'Бизнес-анализ'
  | 'Системный анализ'
  | 'Разработка игр'
  | 'AR/VR'
  | 'IoT'
  | 'Автоматизация'
  | 'Облачные технологии'

export type CaseComplexity = 'Начальный' | 'Средний' | 'Высокий'
export type ParticipationFormat = 'individual' | 'team' | 'both'
export type WorkFormat = 'дистанционный' | 'очный' | 'смешанный'
export type RewardType = 'educational' | 'contest' | 'monetary' | 'other'
export type PaymentStatus = 'not_provided' | 'pending' | 'confirmed' | 'paid'

export type CaseStatus =
  | 'open'        // Открыт для заявок
  | 'application' // Заявка
  | 'selection'   // Отбор
  | 'accepted'    // Принята
  | 'in_progress' // Выполняется
  | 'submitted'   // Представлен результат
  | 'review'      // На проверке
  | 'revision'    // Требуется доработка
  | 'completed'   // Выполнен
  | 'archived'    // Завершён
  | 'moderation'  // На модерации

export type IPRightsType =
  | 'author'
  | 'exclusive_company'
  | 'non_exclusive_license'
  | 'open_source'
  | 'custom_agreement'

export interface PrizePlace {
  place: number
  reward: string
  criteria: string
  winnerName?: string
  winnerTeamId?: string
}

export interface CaseProject {
  moderationStatus?: ModerationStatus
  moderationComment?: string
  id: string
  title: string
  companyId: string
  companyName: string
  companyLogo: string
  shortDescription: string
  fullDescription: string
  direction: ProjectDirection
  complexity: CaseComplexity
  participationFormat: ParticipationFormat
  teamSize: { min: number; max: number }
  requiredCompetencies: string[]
  recommendedTech: string[]
  deadlineDate: string
  duration: string
  workFormat: WorkFormat
  resultRequirements: string
  evaluationOrder: string
  rewardType: RewardType
  rewardAmount?: number
  rewardDescription?: string
  prizeFund?: number
  prizePlaces?: PrizePlace[]
  paymentStatus: PaymentStatus
  status: CaseStatus
  isConfidential: boolean // NDA required
  ipRights: IPRightsType
  publishedAt: string
  viewsCount: number
  applicationsCount: number
  assignedTeamId?: string
  assignedTeamName?: string
  assignedStudentId?: string
  assignedStudentName?: string
  curatorId?: string
  curatorName?: string
  winnerInfo?: string
  isModerated: boolean
}

export type ApplicationStatus = 'pending' | 'interview' | 'accepted' | 'rejected' | 'need_info'

export interface CaseApplication {
  id: string
  caseId: string
  caseTitle: string
  companyId: string
  applicantType: 'individual' | 'team'
  studentId: string
  studentName: string
  studentEmail: string
  studentPhone: string
  studentCourse: number
  studentInstitute: string
  studentAvatar?: string
  teamId?: string
  teamName?: string
  coverLetter: string
  resumeUrl: string
  portfolioUrl: string
  githubUrl: string
  previousProjects: string[]
  status: ApplicationStatus
  companyNotes?: string
  createdAt: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
  competencies: string[]
  avatar?: string
  email?: string
}

export interface ProjectTeam {
  id: string
  name: string
  leaderId: string
  leaderName: string
  members: TeamMember[]
  caseId?: string
  createdAt: string
}

export type MilestoneTitle =
  | 'Анализ задачи'
  | 'Проектирование'
  | 'Создание прототипа'
  | 'Разработка MVP'
  | 'Тестирование'
  | 'Финальная версия'
  | 'Защита проекта'

export type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'accepted' | 'needs_work'

export interface ProjectMilestone {
  id: string
  caseId: string
  stepNumber: number
  title: MilestoneTitle | string
  deadline: string
  description: string
  status: MilestoneStatus
  attachedMaterials: { name: string; url: string; size?: string }[]
  submittedAt?: string
  feedback?: string
}

export interface ProjectSubmission {
  id: string
  caseId: string
  studentId?: string
  teamId?: string
  authorName: string
  description: string
  repoUrl: string
  presentationUrl?: string
  videoUrl?: string
  screenshots: string[]
  documentationUrl?: string
  demoUrl?: string
  attachedFiles: { name: string; url: string }[]
  submittedAt: string
  acceptedAt?: string
}

export interface ProjectEvaluation {
  id: string
  caseId: string
  companyId: string
  companyName: string
  evaluatorName: string
  scores: {
    solutionCompleteness: number      // 1. полнота решения
    implementationQuality: number     // 2. качество реализации
    codeQuality: number               // 3. качество программного кода
    architecture: number              // 4. архитектура
    specCompliance: number            // 5. соответствие техническому заданию
    usability: number                 // 6. удобство использования
    originality: number               // 7. оригинальность
    documentationQuality: number      // 8. качество документации
    deadlineCompliance: number        // 9. соблюдение сроков
    teamwork: number                  // 10. командная работа
  }
  totalScore: number
  maxScore: number
  feedback: string
  winnerPlace?: number
  nomination?: string
  evaluatedAt: string
}

export type StudentProjectCategory =
  | 'учебный'
  | 'курсовой'
  | 'ВКР'
  | 'хакатон'
  | 'pet-проект'
  | 'стартап'
  | 'НИР'
  | 'командный проект'
  | 'open-source'

export type StudentProjectBadge =
  | 'seeking_company'      // Ищу компанию / партнёра
  | 'seeking_team'         // Ищу команду
  | 'seeking_mentor'       // Ищу наставника
  | 'seeking_investor'     // Ищу инвестора
  | 'open_for_internship'  // Открыт к предложениям о стажировке
  | 'open_for_job'         // Открыт к предложениям о работе

export interface StudentProject {
  moderationStatus?: ModerationStatus
  moderationComment?: string
  id: string
  title: string
  coverImage: string
  authorId: string
  authorName: string
  teamName?: string
  category: StudentProjectCategory
  shortDescription: string
  fullDescription: string
  problemSolved: string
  technologies: string[]
  direction: ProjectDirection
  createdAt: string
  status: 'в разработке' | 'готовый продукт' | 'архив'
  githubUrl?: string
  productUrl?: string
  presentationUrl?: string
  videoUrl?: string
  screenshots: string[]
  badges: StudentProjectBadge[]
  isModerated: boolean
  likesCount: number
}

export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  userRole: UserRole
  actionType:
    | 'auth_login'
    | 'case_create'
    | 'case_update'
    | 'case_delete'
    | 'status_change'
    | 'application_accept'
    | 'application_reject'
    | 'evaluation_submit'
    | 'winner_assigned'
    | 'reward_update'
    | 'user_blocked'
    | 'user_role_change'
    | 'moderation_action'
  objectType: string
  objectId: string
  objectName: string
  previousValue?: string
  newValue?: string
  details?: string
}

export interface SystemNotification {
  id: string
  userId: string
  type:
    | 'publication_status'
    | 'new_case'
    | 'application_status'
    | 'team_invite'
    | 'company_invite'
    | 'new_comment'
    | 'milestone_deadline'
    | 'revision_needed'
    | 'result_accepted'
    | 'prize_awarded'
    | 'review_received'
  title: string
  message: string
  read: boolean
  link?: string
  createdAt: string
}

export interface ProjectComment {
  id: string
  caseId: string
  authorId: string
  authorName: string
  authorRole: UserRole
  authorAvatar?: string
  content: string
  createdAt: string
  attachment?: { name: string; url: string }
}
