import { useEffect, useMemo, useState } from 'react'
import { apiRuntime } from '../api/runtime'
import { mockServer } from '../api/mockRuntime'
import { createId } from '../utils/id'
import { collectPages } from '../api/backend'
import { axiosInstance } from '../api/http'
import { useAppSelector } from '../store'
import type { CaseProject } from '../types/models'
import type { Execution } from '../types/execution'
import { CommentAuthor } from './CommentAuthor'
import { CommentComposer } from './CommentComposer'

type Comment = {
  comment_id: string
  parent_comment_id?: string | null
  author_id: string
  author_name?: string
  author_photo_file_id?: string
  body: string
  created_at: string
}

const mockStorageKey = 'showcase_curated_v1_execution_comments'

export function ExecutionComments({ entry, project }: { entry: Execution; project: CaseProject }) {
  const user = useAppSelector((state) => state.auth.currentUser)
  const users = useAppSelector((state) => state.auth.allUsers)
  const students = useAppSelector((state) => state.students.studentsList)
  const companyLogo = useAppSelector(
    (state) => state.companies.companiesList.find((item) => item.id === project.companyId)?.logo,
  )
  const [comments, setComments] = useState<Comment[]>([])
  const [sort, setSort] = useState('newest')
  const [replyId, setReplyId] = useState<string>()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const path = `/executions/${entry.id}/comments`
  const live = apiRuntime.mode === 'live'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    async function load() {
      if (live) return collectPages<Comment>((params) => axiosInstance.get(path, { params }))
      const execution = mockServer.getExecutions(project.id).find((item) => item.id === entry.id)
      if (!execution) throw new Error('Нет доступа к обсуждению.')
      const stored = JSON.parse(localStorage.getItem(mockStorageKey) || '{}')
      if (!Object.prototype.hasOwnProperty.call(stored, entry.id)) {
        const member = execution.members[0]
        stored[entry.id] =
          execution.submission && member
            ? [
                {
                  comment_id: 'discussion_' + entry.id,
                  author_id: member.id,
                  author_name: member.name,
                  body:
                    execution.status === 'evaluated'
                      ? 'Проверили замечания по результату. Описали ограничения, добавили шаги воспроизведения и граничные сценарии в материалы решения. Готовы обсудить оценку на следующей встрече.'
                      : 'Материалы этой команды готовы к проверке. Обратите внимание на обработку пустых данных и повторных действий: эти сценарии описаны отдельно. Вопрос к наставнику: достаточно ли текущего набора проверок для защиты?',
                  created_at: '2026-11-10T10:00:00Z',
                },
              ]
            : []
        localStorage.setItem(mockStorageKey, JSON.stringify(stored))
      }
      return stored[entry.id] as Comment[]
    }
    void load()
      .then((items) => {
        if (active) setComments(items)
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [entry.id, live, path, project.id, user?.id])

  const threads = useMemo(() => {
    const ordered = [...comments].sort((left, right) =>
      left.created_at.localeCompare(right.created_at),
    )
    const byId = new Set(ordered.map((comment) => comment.comment_id))
    const children = new Map<string, Comment[]>()
    const roots: Comment[] = []
    for (const comment of ordered) {
      const parent = comment.parent_comment_id
      if (!parent || !byId.has(parent)) roots.push(comment)
      else {
        const replies = children.get(parent) ?? []
        replies.push(comment)
        children.set(parent, replies)
      }
    }
    if (sort === 'newest') roots.reverse()
    return roots.map((root) => {
      const replies: Comment[] = []
      const pending = [...(children.get(root.comment_id) ?? [])]
      for (let index = 0; index < pending.length; index++) {
        const reply = pending[index]
        replies.push(reply)
        pending.push(...(children.get(reply.comment_id) ?? []))
      }
      replies.sort((left, right) => left.created_at.localeCompare(right.created_at))
      return { root, replies }
    })
  }, [comments, sort])

  const identify = (comment: Comment) => {
    const id = comment.author_id
    const member = entry.members.find((item) => item.id === id)
    const author =
      id === user?.id
        ? user
        : users.find((item) => item.id === id) || students.find((item) => item.id === id)
    const organizer =
      id === project.createdBy ||
      (!!project.companyId && author?.companyProfile?.companyId === project.companyId)
    const isStudent = !!member || author?.role === 'student' || !!comment.author_photo_file_id
    const studentPhoto = comment.author_photo_file_id
      ? `?v=${encodeURIComponent(comment.author_photo_file_id)}`
      : ''
    return {
      name:
        author?.fullName ||
        member?.name ||
        comment.author_name ||
        (organizer ? project.companyName || 'Организатор' : 'Автор комментария'),
      avatar:
        author?.avatar ||
        member?.avatar ||
        (isStudent && live
          ? `/api/v1/students/${id}/photo${studentPhoto}`
          : organizer
            ? companyLogo || project.companyLogo
            : undefined),
      to: isStudent
        ? `/profile/${id}`
        : organizer && project.companyId
          ? `/company/${project.companyId}`
          : undefined,
    }
  }

  const send = async (body: string, parentId?: string, rootId?: string) => {
    if (!user) throw new Error('Войдите, чтобы отправить комментарий.')
    let added: Comment
    if (live) {
      added = (await axiosInstance.post<Comment>(path, { body, parent_comment_id: parentId })).data
    } else {
      if (!mockServer.getExecutions(project.id).some((item) => item.id === entry.id))
        throw new Error('Нет доступа к обсуждению.')
      added = {
        comment_id: createId(),
        parent_comment_id: parentId,
        author_id: user.id,
        author_name: user.fullName,
        body,
        created_at: new Date().toISOString(),
      }
      const stored = JSON.parse(localStorage.getItem(mockStorageKey) || '{}')
      localStorage.setItem(
        mockStorageKey,
        JSON.stringify({
          ...stored,
          [entry.id]: [added, ...(stored[entry.id] || [])],
        }),
      )
    }
    setComments((items) =>
      items.some((item) => item.comment_id === added.comment_id) ? items : [...items, added],
    )
    if (rootId) setExpanded((current) => new Set(current).add(rootId))
    if (parentId) setReplyId((current) => (current === parentId ? undefined : current))
  }

  const commentCard = (comment: Comment, rootId: string) => {
    const author = identify(comment)
    const own = user?.id === comment.author_id
    return (
      <article className="comment-item" key={comment.comment_id}>
        <header className="comment-header">
          <CommentAuthor id={comment.author_id} {...author} />
          <time dateTime={comment.created_at}>
            {new Date(comment.created_at).toLocaleString('ru-RU', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </header>
        <p className="preserve-text">{comment.body}</p>
        {user && (
          <button
            type="button"
            className="text-toggle"
            aria-expanded={replyId === comment.comment_id}
            onClick={() => setReplyId(comment.comment_id)}
          >
            Ответить
          </button>
        )}
        {user && replyId === comment.comment_id && (
          <CommentComposer
            author={user}
            replyTo={own || author.name === 'Автор комментария' ? undefined : author.name}
            maxLength={5000}
            disabled={loading}
            onSend={(body) => send(body, comment.comment_id, rootId)}
            onCancel={() => setReplyId(undefined)}
          />
        )}
      </article>
    )
  }

  return (
    <section className="execution-comments comments-panel">
      <div className="comments-heading">
        <h2>
          Комментарии <span>{comments.length}</span>
        </h2>
        <label className="comment-sort-control">
          Порядок
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
          </select>
        </label>
      </div>
      {loading && <p role="status">Загрузка комментариев…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {user && <CommentComposer author={user} disabled={loading} maxLength={5000} onSend={send} />}
      {!loading && !comments.length && !error && <p>Комментариев пока нет.</p>}
      <div className="comments-list">
        {threads.map(({ root, replies }) => {
          const id = root.comment_id
          const open = expanded.has(id)
          return (
            <div className="execution-comment-thread" key={id}>
              {commentCard(root, id)}
              {!!replies.length && (
                <div className="execution-comment-thread__replies">
                  <button
                    type="button"
                    className="text-toggle"
                    aria-expanded={open}
                    onClick={() => {
                      setExpanded((current) => {
                        const next = new Set(current)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })
                    }}
                  >
                    {open ? 'Скрыть ответы' : `Показать ответы (${replies.length})`}
                  </button>
                  {open && (
                    <div className="execution-comment-thread__branch">
                      {replies.map((comment) => commentCard(comment, id))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
