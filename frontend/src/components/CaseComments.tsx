import { useConfirm } from './ConfirmProvider'
import { Heart, SlidersHorizontal } from 'lucide-react'
import { PaginatedGrid } from './PaginatedGrid'
import React, { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { axiosInstance } from '../api/http'
import { apiRuntime } from '../api/runtime'
import { communityApi } from '../api/community'
import { useAppSelector } from '../store'
import type { CaseProject, ProjectComment } from '../types/models'
import { CommentAuthor } from './CommentAuthor'
import { CommentComposer } from './CommentComposer'
import { ReportButton } from './ReportButton'

export const CaseComments: React.FC<{ project: CaseProject }> = ({ project }) => {
  const caseId = project.id
  const confirm = useConfirm()
  const user = useAppSelector((s) => s.auth.currentUser)
  const users = useAppSelector((s) => s.auth.allUsers)
  const students = useAppSelector((s) => s.students.studentsList)
  const canComment =
    apiRuntime.mode === 'mock' ||
    (project.visibility !== 'private' &&
      ['open', 'in_progress', 'completed'].includes(project.status))
  const [comments, setComments] = useState<ProjectComment[]>([]),
    [sort, setSort] = useState('newest'),
    [parentId, setParentId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!canComment) return
    let active = true
    apiClient
      .getComments(caseId)
      .then((items) => {
        if (active) setComments(items)
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })
    return () => {
      active = false
    }
  }, [caseId, canComment])
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
  const identify = (comment: ProjectComment) => {
    const id = comment.authorId
    const author =
      id === user?.id
        ? user
        : users.find((item) => item.id === id) || students.find((item) => item.id === id)
    const organizer =
      id === project.createdBy ||
      (!!project.companyId && author?.companyProfile?.companyId === project.companyId)
    const isStudent =
      author?.role === 'student' ||
      (apiRuntime.mode === 'mock' ? comment.authorRole === 'student' : !!comment.authorAvatar)
    return {
      name:
        author?.fullName ||
        comment.authorName ||
        (organizer ? project.companyName : '') ||
        undefined,
      avatar: author?.avatar || comment.authorAvatar,
      to: isStudent ? `/profile/${id}` : organizer ? `/company/${project.companyId}` : undefined,
    }
  }
  const post = async (text: string, target?: ProjectComment) => {
    if (!user) throw new Error('Войдите, чтобы отправить комментарий.')
    // The public case API only accepts replies to root comments.
    const nestedReply = apiRuntime.mode === 'live' && target?.parentId
    const recipient = nestedReply && target ? identify(target).name : undefined
    const content = recipient ? `${recipient}, ${text}` : text
    if (new TextEncoder().encode(content).length > 4000) {
      throw new Error('Сократите комментарий до 4 000 байт.')
    }
    const added = await apiClient.addComment({
      caseId,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      authorAvatar: user.avatar,
      content,
      parentId: nestedReply || target?.id,
    })
    setComments((items) => (items.some((item) => item.id === added.id) ? items : [added, ...items]))
    const branchId = added.parentId
    if (branchId) {
      const visibleCount = comments.filter((comment) => comment.parentId === branchId).length + 1
      setShown((current) => ({
        ...current,
        [branchId]: Math.max(current[branchId] || 10, visibleCount),
      }))
    }
    if (target) setParentId((current) => (current === target.id ? '' : current))
  }
  const renderComment = (comment: ProjectComment): React.ReactNode => {
    const author = identify(comment)
    return (
      <article className="comment-item" key={comment.id}>
        <div className="comment-header">
          <CommentAuthor
            id={comment.authorId}
            {...author}
            name={author.name || 'Автор комментария'}
          />
          <time dateTime={comment.createdAt}>
            {new Date(comment.createdAt).toLocaleString('ru-RU', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </div>
        <p className="preserve-text">{comment.content}</p>
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
          {user && !comment.deleted && (
            <button
              type="button"
              className="text-toggle"
              aria-expanded={parentId === comment.id}
              onClick={() => setParentId(comment.id)}
            >
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
        {user && !comment.deleted && parentId === comment.id && (
          <CommentComposer
            author={user}
            replyTo={comment.authorId === user.id ? undefined : author.name}
            maxLength={4000}
            disabled={busy}
            onSend={(text) => post(text, comment)}
            onCancel={() => setParentId('')}
          />
        )}
        {comments.some((c) => c.parentId === comment.id) && (
          <button
            type="button"
            className="text-toggle"
            aria-expanded={!!shown[comment.id]}
            onClick={() => setShown((s) => ({ ...s, [comment.id]: s[comment.id] ? 0 : 10 }))}
          >
            {shown[comment.id]
              ? 'Скрыть ответы'
              : `Показать ответы (${comments.filter((c) => c.parentId === comment.id).length})`}
          </button>
        )}
        {sorted(comments.filter((c) => c.parentId === comment.id))
          .slice(0, shown[comment.id] || 0)
          .map((c) => renderComment(c))}
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
  }
  return (
    <section className="card feature-panel comments-panel">
      <div className="comments-heading">
        <h2>
          Комментарии <span>{comments.length}</span>
        </h2>
        {canComment && (
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
        )}
      </div>

      {canComment ? (
        <>
          {user && <CommentComposer author={user} disabled={busy} maxLength={4000} onSend={post} />}
          {error && <p role="alert">{error}</p>}
          <PaginatedGrid className="comments-list" pageSize={10}>
            {sorted(comments.filter((c) => !c.parentId)).map((c) => renderComment(c))}
          </PaginatedGrid>
          {!comments.length && <p>Комментариев пока нет.</p>}
        </>
      ) : (
        <p>Комментарии доступны в открытых опубликованных кейсах.</p>
      )}
    </section>
  )
}
