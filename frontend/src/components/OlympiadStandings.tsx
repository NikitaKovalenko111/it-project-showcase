import { useEffect, useState } from 'react'
import {
  getEventPlan,
  getRoundSubmissions,
  type EventRound,
  type RoundSubmission,
} from '../api/events'
import type { Execution } from '../types/execution'
import { ReportTableView } from './ReportTableView'

type Standing = { id: string; name: string; total: number; submissions: RoundSubmission[] }

export function OlympiadStandings({
  caseId,
  entries,
  manager,
}: {
  caseId: string
  entries: Execution[]
  manager: boolean
}) {
  const [rounds, setRounds] = useState<EventRound[]>([])
  const [rows, setRows] = useState<Standing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setRows([])
    const load = async () => {
      const plan = await getEventPlan(caseId)
      const standings: Standing[] = []
      for (let offset = 0; offset < entries.length && active; offset += 8) {
        const batch = await Promise.all(
          entries.slice(offset, offset + 8).map(async (entry) => {
            const data = await getRoundSubmissions(entry.id)
            return {
              id: entry.id,
              name: entry.name,
              total: data.total_score,
              submissions: data.items || [],
            }
          }),
        )
        standings.push(...batch)
      }
      if (!active) return
      setRounds(plan.rounds || [])
      setRows(standings.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ru')))
    }
    load()
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [caseId, entries])
  return (
    <section>
      <h2>{manager ? 'Сводка по турам' : 'Мои баллы по турам'}</h2>
      <p>В сумму входят только оценённые туры.</p>
      {loading ? (
        <p role="status">Загрузка результатов…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <ReportTableView
          label="Результаты олимпиады"
          headers={[
            'Команда / участник',
            ...rounds.map((round, index) => `${index + 1}. ${round.title}`),
            'Сумма',
          ]}
          rows={rows.map((row) => ({
            id: row.id,
            cells: [
              row.name,
              ...rounds.map((round) => {
                const submission = row.submissions.find((item) => item.round_id === round.round_id)
                return !submission
                  ? 'Нет сдачи'
                  : submission.total_score == null
                    ? 'На проверке'
                    : `${submission.total_score} / ${submission.max_score}`
              }),
              row.total,
            ],
          }))}
          emptyText="Результатов пока нет."
        />
      )}
    </section>
  )
}
