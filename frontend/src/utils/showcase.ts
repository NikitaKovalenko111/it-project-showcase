import type { CaseProject } from '../types/models'

export type ShowcasePeriod = 'all' | 'sem1' | 'sem2' | 'year'
export type ShowcaseSort = 'newest' | 'deadline' | 'popular'

// Academic year: September through August. Compare calendar dates without timezone shifts.
export function selectShowcaseCases(
  cases: CaseProject[],
  options: { period: ShowcasePeriod; technology: string; recruiting: boolean; sort: ShowcaseSort },
  today = new Date(),
): CaseProject[] {
  const year = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1
  const start = options.period === 'sem2' ? `${year + 1}-02-01` : `${year}-09-01`
  const end = options.period === 'sem1' ? `${year + 1}-02-01` : `${year + 1}-09-01`
  return cases.filter((item) => {
    const published = item.publishedAt.slice(0, 10)
    return (options.period === 'all' || (published >= start && published < end))
      && (options.technology === 'all' || [...item.requiredCompetencies, ...item.recommendedTech, item.direction]
        .some((tech) => tech.toLocaleLowerCase('ru').includes(options.technology.toLocaleLowerCase('ru'))))
      && (!options.recruiting || item.status === 'open')
  }).sort((a, b) => {
    const order = options.sort === 'deadline' ? a.deadlineDate.localeCompare(b.deadlineDate)
      : options.sort === 'popular' ? b.applicationsCount - a.applicationsCount
      : b.publishedAt.localeCompare(a.publishedAt)
    return order || a.id.localeCompare(b.id)
  })
}
