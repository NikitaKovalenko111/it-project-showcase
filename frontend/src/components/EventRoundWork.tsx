import { useEffect, useState } from 'react'
import {
  getEventPlan,
  getRoundSubmissions,
  gradeRound,
  submitRound,
  type EventPlan,
  type RoundSubmission,
} from '../api/events'
import { uploadFile } from '../utils/files'
import { FileDownload } from './FileDownload'

type Answer = { text?: string; url?: string; file?: File }

export function EventRoundWork({
  caseId,
  executionId,
  participant,
  manager,
}: {
  caseId: string
  executionId: string
  participant: boolean
  manager: boolean
}) {
  const [plan, setPlan] = useState<EventPlan>()
  const [result, setResult] = useState<{ items: RoundSubmission[]; total_score: number }>()
  const [selected, setSelected] = useState('')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([getEventPlan(caseId), getRoundSubmissions(executionId)])
      .then(([event, work]) => {
        if (active) {
          setPlan(event)
          setResult(work)
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [caseId, executionId])
  if (!plan || !result)
    return <p role={error ? 'alert' : 'status'}>{error || 'Загрузка туров и решений…'}</p>
  const round = plan.rounds.find((item) => item.round_id === selected) || plan.rounds[0]
  if (!round?.round_id) return <p>Организатор пока не добавил туры.</p>
  const roundId = round.round_id
  const tasks = (round.tasks || []).filter((task) => task.task_id)
  const submitted = result.items.find((item) => item.round_id === roundId)
  const open = Date.now() >= Date.parse(round.opens_at) && Date.now() < Date.parse(round.due_at)
  const changeAnswer = (id: string, patch: Answer) =>
    setAnswers((values) => ({ ...values, [id]: { ...values[id], ...patch } }))
  return (
    <section className="execution-form">
      <label>
        Тур
        <select
          className="select"
          value={roundId}
          onChange={(e) => {
            setSelected(e.target.value)
            setError('')
          }}
        >
          {plan.rounds.map((item) => (
            <option value={item.round_id} key={item.round_id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <p>
        Сумма баллов по оценённым турам: <strong>{result.total_score}</strong>
      </p>
      {round.rules && <p className="preserve-text">{round.rules}</p>}
      {!tasks.length && <p>Условия появятся после открытия тура.</p>}
      {submitted && (
        <p role="status">
          {submitted.total_score == null
            ? 'Тур сдан, оценка ещё не выставлена.'
            : `За тур: ${submitted.total_score} / ${submitted.max_score}`}
          {submitted.evaluator_name && ` · ${submitted.evaluator_name}`}
        </p>
      )}
      <form
        className="execution-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            if (submitted && manager) {
              await gradeRound(
                executionId,
                roundId,
                tasks.map((task) => ({
                  task_id: task.task_id!,
                  score:
                    scores[task.task_id!] ??
                    submitted.scores?.find((item) => item.task_id === task.task_id)?.score ??
                    0,
                })),
              )
            } else if (participant && open && !submitted) {
              const filled = tasks.flatMap((task) => {
                const answer = answers[task.task_id!]
                return answer && (answer.text?.trim() || answer.url?.trim() || answer.file)
                  ? [{ taskId: task.task_id!, answer }]
                  : []
              })
              if (!filled.length) throw new Error('Добавьте решение хотя бы одной задачи.')
              const solutions = await Promise.all(
                filled.map(async ({ taskId, answer }) => ({
                  task_id: taskId,
                  text: answer.text?.trim(),
                  url: answer.url?.trim(),
                  file_id: answer.file ? (await uploadFile(answer.file)).file_id : undefined,
                })),
              )
              await submitRound(executionId, roundId, solutions)
            }
            setResult(await getRoundSubmissions(executionId))
          } catch (cause) {
            setError((cause as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <fieldset disabled={busy} className="execution-form">
          {tasks.map((task) => {
            const id = task.task_id!
            const solution = submitted?.solutions?.find((item) => item.task_id === id)
            const score = submitted?.scores?.find((item) => item.task_id === id)?.score
            return (
              <article className="shared-plan-row execution-form" key={id}>
                <h4>
                  {task.title} · до {task.max_score} баллов
                </h4>
                <p className="preserve-text">{task.statement}</p>
                {(task.file_ids || []).map((fileId) => (
                  <FileDownload
                    key={fileId}
                    file={{
                      name: 'Материал задания',
                      url: `/api/v1/cases/${caseId}/rounds/${roundId}/tasks/${id}/files/${fileId}`,
                    }}
                  />
                ))}
                {submitted && (
                  <>
                    <p className="preserve-text">
                      {solution?.text || (!solution ? 'Решение не приложено.' : '')}
                    </p>
                    {solution?.url && (
                      <a href={solution.url} target="_blank" rel="noreferrer">
                        Ссылка на решение
                      </a>
                    )}
                    {solution?.file_id && (
                      <FileDownload
                        file={{
                          name: 'Файл решения',
                          url: `/api/v1/executions/${executionId}/rounds/${roundId}/files/${solution.file_id}`,
                        }}
                      />
                    )}
                    {manager ? (
                      <label>
                        Баллы
                        <input
                          className="input"
                          type="number"
                          min="0"
                          max={task.max_score}
                          step="0.01"
                          value={scores[id] ?? score ?? 0}
                          onChange={(e) =>
                            setScores((values) => ({ ...values, [id]: +e.target.value }))
                          }
                        />
                      </label>
                    ) : (
                      score != null && (
                        <p>
                          Оценка: {score} / {task.max_score}
                        </p>
                      )
                    )}
                  </>
                )}
                {!submitted && open && participant && (
                  <>
                    <label>
                      Текст решения
                      <textarea
                        className="textarea"
                        maxLength={30000}
                        value={answers[id]?.text || ''}
                        onChange={(e) => changeAnswer(id, { text: e.target.value })}
                      />
                    </label>
                    <label>
                      Ссылка на решение
                      <input
                        className="input"
                        type="url"
                        value={answers[id]?.url || ''}
                        onChange={(e) => changeAnswer(id, { url: e.target.value })}
                      />
                    </label>
                    <label>
                      Файл решения
                      <input
                        key={id}
                        type="file"
                        className="input"
                        onChange={(e) => changeAnswer(id, { file: e.target.files?.[0] })}
                      />
                    </label>
                    {answers[id]?.file && <small>Выбран файл: {answers[id].file?.name}</small>}
                  </>
                )}
              </article>
            )
          })}
          {tasks.length > 0 && ((!submitted && open && participant) || (submitted && manager)) && (
            <button className="btn btn-primary">
              {submitted ? 'Сохранить оценку тура' : 'Сдать тур'}
            </button>
          )}
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  )
}
