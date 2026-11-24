import { IdentityImage } from './IdentityImage'
import { useConfirm } from './ConfirmProvider'
import { Heart, SlidersHorizontal } from 'lucide-react'
import { PaginatedGrid } from './PaginatedGrid'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { axiosInstance } from '../api/http'
import { apiRuntime } from '../api/runtime'
import { communityApi } from '../api/community'
import { useAppSelector } from '../store'
import { ProjectComment } from '../types/models'
import { ReportButton } from './ReportButton'

export const CaseComments: React.FC<{ caseId: string }> = ({ caseId }) => {
  const confirm = useConfirm()
  const user = useAppSelector((s) => s.auth.currentUser)
  const users = useAppSelector((s) => s.auth.allUsers)
  const [comments, setComments] = useState<ProjectComment[]>([]),
    [sort, setSort] = useState('newest'),
    [text, setText] = useState(''),
    [parentId, setParentId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    apiClient
      .getComments(caseId)
      .then(setComments)
      .catch((e) => setError(e.message))
  }, [caseId])
  const [shown, setShown] = useState<Record<string, number>>({})
  const count = (comment: ProjectComment) => comment.likesCount ?? comment.likedBy?.length ?? 0
  const liked = (comment: ProjectComment) =>
    comment.likedByMe ?? !!comment.likedBy?.includes(user?.id || '')
  const sorted = (items: ProjectComment[]) =>
    [...items].sort((a, b) => {
      const likes = count(b) - count(a)
      const popularity =
        likes +
        comments.filter((c) => c.parentId === b.id).length -
        comments.filter((c) => c.parentId === a.id).length
      return (
        (sort === 'likes' ? likes : sort === 'popular' ? popularity : 0) ||
        (sort === 'oldest'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt))
      )
    })
  const commentForm = user && (
    <form
      className="comment-compose"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy || !text.trim()) return
        const form = e.currentTarget
        const target = comments.find((comment) => comment.id === parentId)
        // The case comments API accepts replies to a root comment only.
        const nestedReply = apiRuntime.mode === 'live' && target?.parentId
        const content = nestedReply ? target.authorName + ', ' + text.trim() : text.trim()
        if (new TextEncoder().encode(content).length > 4000) {
          setError('Сократите комментарий до 4 000 байт.')
          return
        }
        setBusy(true)
        setError('')
        try {
          const added = await apiClient.addComment({
            caseId,
            authorId: user.id,
            authorName: user.fullName,
            authorRole: user.role,
            authorAvatar: user.avatar,
            content,
            parentId: nestedReply || parentId || undefined,
          })
          form.reset()
          setText('')
          setComments((items) =>
            items.some((item) => item.id === added.id) ? items : [added, ...items],
          )
          const branchId = added.parentId
          if (branchId) {
            const visibleCount =
              comments.filter((comment) => comment.parentId === branchId).length + 1
            setShown((current) => ({
              ...current,
              [branchId]: Math.max(current[branchId] || 10, visibleCount),
            }))
          }
          setParentId('')
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      {parentId && (
        <p>
          Ответ на комментарий {comments.find((c) => c.id === parentId)?.authorName}{' '}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setParentId('')}
          >
            Отмена
          </button>
        </p>
      )}
      <IdentityImage
        src={user.avatar}
        name={user.fullName}
        className="comment-avatar comment-compose-avatar"
      />
      <label>
        <span className="sr-only">Ваш комментарий</span>
        <textarea
          placeholder="Введите комментарий"
          rows={1}
          data-min-rows="1"
          className="textarea"
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            if (text.trim() && !busy) event.currentTarget.form?.requestSubmit()
          }}
          required
        />
      </label>
      <button className="btn btn-primary" disabled={busy || !text.trim()}>
        Отправить
      </button>
      <span className="form-hint comment-compose__shortcut">
        Enter — отправить, Shift+Enter — новая строка
      </span>
    </form>
  )
  const renderComment = (comment: ProjectComment, depth = 0): React.ReactNode => (
    <article className="comment-item" key={comment.id}>
      <div className="comment-header">
        <Link className="comment-author" to={`/profile/${comment.authorId}`}>
          <IdentityImage
            src={
              comment.authorId === user?.id
                ? user.avatar
                : users.find((author) => author.id === comment.authorId)?.avatar ||
                  comment.authorAvatar
            }
            name={comment.authorName || 'Участник'}
            className="comment-avatar"
          />
          {comment.authorName}
        </Link>
        <time>
          {new Date(comment.createdAt).toLocaleString('ru-RU', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </time>
      </div>
      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{comment.content}</p>
      <div className="action-row">
        <button
          className="comment-like"
          aria-label="Поставить или убрать лайк"
          disabled={busy || !user}
          aria-pressed={liked(comment)}
          onClick={async () => {
            setBusy(true)
            try {
              const updated =
                apiRuntime.mode === 'live'
                  ? await axiosInstance
                      .request({
                        url: `/comments/${comment.id}/like`,
                        method: liked(comment) ? 'DELETE' : 'PUT',
                      })
                      .then(({ data }) => ({
                        ...comment,
                        likesCount: data.likes_count,
                        likedByMe: data.liked_by_me,
                      }))
                  : await communityApi.likeComment(comment.id)
              setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <Heart size={18} fill={liked(comment) ? 'currentColor' : 'none'} /> {count(comment)}
        </button>
        {user && (
          <button className="btn btn-secondary btn-sm" onClick={() => setParentId(comment.id)}>
            Ответить
          </button>
        )}
        {user?.id === comment.authorId &&
          !comment.deleted &&
          (apiRuntime.mode === 'live' || comment.content !== 'Комментарий удалён') && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={async () => {
                if (!(await confirm('Удалить комментарий? Ответы сохранятся.'))) return
                setBusy(true)
                try {
                  await apiClient.deleteComment(caseId, comment.id)
                  setComments((items) =>
                    items.map((item) =>
                      item.id === comment.id
                        ? {
                            ...item,
                            deleted: true,
                            content: 'Комментарий удалён',
                            likesCount: 0,
                            likedByMe: false,
                          }
                        : item,
                    ),
                  )
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Удалить
            </button>
          )}
        <ReportButton targetType="comment" targetId={comment.id} compact />
      </div>
      {parentId === comment.id && commentForm}
      {comments.some((c) => c.parentId === comment.id) && (
        <button
          className="btn btn-secondary btn-sm"
          aria-expanded={!!shown[comment.id]}
          onClick={() => setShown((s) => ({ ...s, [comment.id]: s[comment.id] ? 0 : 10 }))}
        >
          {shown[comment.id]
            ? 'Скрыть ответы'
            : `Ответы: ${comments.filter((c) => c.parentId === comment.id).length}`}
        </button>
      )}
      {sorted(comments.filter((c) => c.parentId === comment.id))
        .slice(0, shown[comment.id] || 0)
        .map((c) => renderComment(c, depth + 1))}
      {!!shown[comment.id] &&
        comments.filter((c) => c.parentId === comment.id).length > shown[comment.id] && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShown((s) => ({ ...s, [comment.id]: s[comment.id] + 10 }))}
          >
            Ещё 10 ответов
          </button>
        )}
    </article>
  )
  return (
    <section className="card feature-panel comments-panel">
      <div className="comments-heading">
        <h2>
          Комментарии <span>{comments.length}</span>
        </h2>
        <label className="comment-sort-control">
          <SlidersHorizontal size={18} />
          <span className="sr-only">Сортировка</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="likes">По лайкам</option>
            <option value="popular">По популярности: лайки и ответы</option>
          </select>
        </label>
      </div>

      {!parentId && commentForm}
      {error && <p role="alert">{error}</p>}
      <PaginatedGrid className="comments-list" pageSize={10}>
        {sorted(comments.filter((c) => !c.parentId)).map((c) => renderComment(c))}
      </PaginatedGrid>
      {!comments.length && <p>Комментариев пока нет.</p>}
    </section>
  )
}
