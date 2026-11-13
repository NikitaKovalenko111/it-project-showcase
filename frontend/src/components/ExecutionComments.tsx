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

export function ExecutionComments({ executionId }: { executionId: string }) {
  const user = useAppSelector((state) => state.auth.currentUser)
  const userId = user?.id
  const users = useAppSelector((state) => state.auth.allUsers)
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
    <section className="execution-comments comments-panel">
      <h3>Комментарии к выполнению</h3>
      {loading && <p role="status">Загрузка комментариев…</p>}
      {!loading && !comments.length && !error && <p>Комментариев пока нет.</p>}
      {comments.map((comment) => {
        const author =
          comment.author_id === userId ? user : users.find((item) => item.id === comment.author_id)
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
      <form
        className="execution-form comment-compose"
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
          Добавить комментарий
        </button>
      </form>
    </section>
  )
}
