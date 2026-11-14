import { apiRuntime } from '../api/runtime'
import { mockServer } from '../api/mockServer'
import { createId } from '../utils/id'
import { IdentityImage } from './IdentityImage'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { collectPages } from '../api/backend'
import { axiosInstance } from '../api/http'
import { useAppSelector } from '../store'

type Comment = {
  comment_id: string
  author_id: string
  author_name?: string
  author_photo_file_id?: string
  body: string
  created_at: string
}

export function ExecutionComments({
  executionId,
  caseId,
}: {
  executionId: string
  caseId: string
}) {
  const user = useAppSelector((state) => state.auth.currentUser)
  const userId = user?.id
  const users = useAppSelector((state) => state.auth.allUsers)
  const [comments, setComments] = useState<Comment[]>([])
  const [sort, setSort] = useState('newest')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const path = `/executions/${executionId}/comments`

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    if (apiRuntime.mode !== 'live') {
      try {
        const entry = mockServer.getExecutions(caseId).find((entry) => entry.id === executionId)
        if (!entry) throw new Error('Нет доступа к обсуждению.')
        const all = JSON.parse(
          localStorage.getItem('showcase_curated_v1_execution_comments') || '{}',
        )
        if (!Object.prototype.hasOwnProperty.call(all, executionId)) {
          all[executionId] = entry.submission
            ? [
                {
                  comment_id: 'discussion_' + executionId,
                  author_id: entry.members[0].id,
                  author_name: entry.members[0].name,
                  body:
                    entry.status === 'evaluated'
                      ? 'Проверили замечания по результату. Описали ограничения, добавили шаги воспроизведения и граничные сценарии в материалы решения. Готовы обсудить оценку на следующей встрече.'
                      : 'Материалы этой команды готовы к проверке. Обратите внимание на обработку пустых данных и повторных действий: эти сценарии описаны отдельно. Вопрос к наставнику: достаточно ли текущего набора проверок для защиты?',
                  created_at: '2026-11-10T10:00:00Z',
                },
              ]
            : []
          localStorage.setItem('showcase_curated_v1_execution_comments', JSON.stringify(all))
        }
        setComments(all[executionId])
      } catch (cause) {
        setError((cause as Error).message)
      }
      setLoading(false)
      return () => {
        active = false
      }
    }
    collectPages<Comment>((params) => axiosInstance.get(path, { params }))
      .then((items) => {
        if (active) setComments(items)
      })
      .catch((e: Error) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [path, userId, caseId])

  return (
    <section className="execution-comments comments-panel">
      <div className="comments-heading">
        <h2>
          Комментарии <span>{comments.length}</span>
        </h2>
        <label className="comment-sort-control">
          Порядок
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
          </select>
        </label>
      </div>
      {loading && <p role="status">Загрузка комментариев…</p>}
      {!loading && !comments.length && !error && <p>Комментариев пока нет.</p>}
      <form
        className="execution-form comment-compose"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!body.trim() || sending) return
          setError('')
          setSending(true)
          try {
            let data: Comment
            if (apiRuntime.mode === 'live')
              data = (await axiosInstance.post<Comment>(path, { body: body.trim() })).data
            else {
              if (
                !user ||
                !mockServer.getExecutions(caseId).some((entry) => entry.id === executionId)
              )
                throw new Error('Нет доступа к обсуждению.')
              data = {
                comment_id: createId(),
                author_id: user.id,
                author_name: user.fullName,
                body: body.trim(),
                created_at: new Date().toISOString(),
              }
              const all = JSON.parse(
                localStorage.getItem('showcase_curated_v1_execution_comments') || '{}',
              )
              localStorage.setItem(
                'showcase_curated_v1_execution_comments',
                JSON.stringify({ ...all, [executionId]: [data, ...(all[executionId] || [])] }),
              )
            }
            setComments((items) =>
              items.some((item) => item.comment_id === data.comment_id) ? items : [data, ...items],
            )
            setBody('')
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setSending(false)
          }
        }}
      >
        <IdentityImage
          className="comment-avatar comment-compose-avatar"
          name={user?.fullName || 'Участник'}
          src={user?.avatar}
        />
        <label>
          <span className="sr-only">Комментарий</span>
          <textarea
            className="textarea"
            rows={1}
            data-min-rows="1"
            placeholder="Введите комментарий"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-sm" disabled={loading || sending || !body.trim()}>
          Отправить
        </button>
      </form>
      {[...comments]
        .sort((a, b) =>
          sort === 'newest'
            ? b.created_at.localeCompare(a.created_at)
            : a.created_at.localeCompare(b.created_at),
        )
        .map((comment) => {
          const author =
            comment.author_id === userId
              ? user
              : users.find((item) => item.id === comment.author_id)
          const name = author?.fullName || comment.author_name || 'Участник'
          return (
            <article className="comment-item" key={comment.comment_id}>
              <div className="comment-header">
                <Link className="comment-author" to={`/profile/${comment.author_id}`}>
                  <IdentityImage
                    className="comment-avatar"
                    name={name}
                    src={
                      author?.avatar ||
                      (comment.author_photo_file_id
                        ? `/api/v1/students/${comment.author_id}/photo?v=${comment.author_photo_file_id}`
                        : undefined)
                    }
                  />
                  {name}
                </Link>
                <time>
                  {new Date(comment.created_at).toLocaleString('ru-RU', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </div>
              <p className="preserve-text">{comment.body}</p>
            </article>
          )
        })}
    </section>
  )
}
