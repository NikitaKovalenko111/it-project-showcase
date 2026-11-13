import { useEffect, useState } from 'react'
import { collectPages } from '../api/backend'
import { axiosInstance } from '../api/http'
import { useAppSelector } from '../store'

type Comment = { comment_id: string; author_id: string; body: string; created_at: string }

export function ExecutionComments({ executionId }: { executionId: string }) {
  const userId = useAppSelector((state) => state.auth.currentUser?.id)
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const path = `/executions/${executionId}/comments`

  useEffect(() => {
    let active = true
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
  }, [path])

  return (
    <section>
      <h3>Комментарии к выполнению</h3>
      {loading && <p role="status">Загрузка комментариев…</p>}
      {!loading && !comments.length && !error && <p>Комментариев пока нет.</p>}
      {comments.map((comment) => (
        <article className="card feature-panel" key={comment.comment_id}>
          <div className="execution-comment-meta">
            <img
              className="comment-avatar"
              src={`/api/v1/students/${comment.author_id}/photo`}
              alt=""
              onError={(event) => {
                event.currentTarget.hidden = true
              }}
            />
            <small>
              {comment.author_id === userId ? 'Вы · ' : ''}
              {new Date(comment.created_at).toLocaleString('ru-RU')}
            </small>
          </div>
          <p className="preserve-text">{comment.body}</p>
        </article>
      ))}
      <form
        className="execution-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!body.trim() || sending) return
          setError('')
          setSending(true)
          try {
            const { data } = await axiosInstance.post<Comment>(path, { body: body.trim() })
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
        <label>
          Комментарий
          <textarea
            className="textarea"
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
          Добавить комментарий
        </button>
      </form>
    </section>
  )
}
