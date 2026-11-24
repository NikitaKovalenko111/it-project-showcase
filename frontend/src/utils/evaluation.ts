export type EvaluationCriterion = { id: string; label: string; weight: number; maxScore?: number }
export const legacyCriteria: EvaluationCriterion[] = [
  ['solutionCompleteness', 'Полнота решения'],
  ['implementationQuality', 'Качество реализации'],
  ['codeQuality', 'Качество кода'],
  ['architecture', 'Архитектура'],
  ['specCompliance', 'Соответствие ТЗ'],
  ['usability', 'Удобство использования'],
  ['originality', 'Оригинальность'],
  ['documentationQuality', 'Документация'],
  ['deadlineCompliance', 'Соблюдение сроков'],
  ['teamwork', 'Командная работа'],
].map(([id, label]) => ({ id, label, weight: 1 }))
// Normalize weights so the maximum remains criteria count × 10.
export function evaluationTotal(criteria: EvaluationCriterion[], scores: Record<string, number>) {
  if (criteria.some((c) => c.maxScore !== undefined))
    return (
      Math.round(
        criteria.reduce(
          (sum, c) => sum + Math.max(0, Math.min(c.maxScore ?? 10, scores[c.id] || 0)),
          0,
        ) * 100,
      ) / 100
    )
  const weight = criteria.reduce((sum, c) => sum + c.weight, 0)
  if (!weight) return 0
  return (
    Math.round(
      (criteria.reduce(
        (sum, c) => sum + Math.max(0, Math.min(10, scores[c.id] || 0)) * c.weight,
        0,
      ) /
        weight) *
        criteria.length *
        100,
    ) / 100
  )
}
