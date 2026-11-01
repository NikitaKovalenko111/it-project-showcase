import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { communityApi } from '../api/community'
import { useAppSelector } from '../store'
import { ProjectComment } from '../types/models'
import { ReportButton } from './ReportButton'

export const CaseComments: React.FC<{ caseId: string }> = ({ caseId }) => {
  const user = useAppSelector((s) => s.auth.currentUser)
  const [comments, setComments] = useState<ProjectComment[]>([]), [sort, setSort] = useState('newest'), [text, setText] = useState(''), [parentId, setParentId] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { apiClient.getComments(caseId).then(setComments).catch((e) => setError(e.message)) }, [caseId])
  const sorted = (items: ProjectComment[]) => [...items].sort((a, b) => {
    const likes = (b.likedBy?.length || 0) - (a.likedBy?.length || 0)
    const popularity = likes + comments.filter((c) => c.parentId === b.id).length - comments.filter((c) => c.parentId === a.id).length
    return (sort === 'likes' ? likes : sort === 'popular' ? popularity : 0) || (sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))
  })
  const renderComment = (comment: ProjectComment, depth = 0): React.ReactNode => <article className="feature-row" key={comment.id} style={{ marginLeft: depth ? 12 : 0 }}>
    <div className="feature-toolbar"><Link to={`/profile/${comment.authorId}`}>{comment.authorName}</Link><time>{new Date(comment.createdAt).toLocaleString('ru-RU')}</time></div><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{comment.content}</p>
    <div className="action-row"><button className="btn btn-secondary btn-sm" disabled={busy || !user} aria-pressed={comment.likedBy?.includes(user?.id || '') || false} onClick={async () => { setBusy(true); try { const updated = await communityApi.likeComment(comment.id); setComments((prev) => prev.map((c) => c.id === updated.id ? updated : c)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}>Нравится · {comment.likedBy?.length || 0}</button>{user && <button className="btn btn-secondary btn-sm" onClick={() => setParentId(comment.id)}>Ответить</button>}<ReportButton targetType="comment" targetId={comment.id} /></div>
    {sorted(comments.filter((c) => c.parentId === comment.id)).map((c) => renderComment(c, depth + 1))}
  </article>
  return <section className="card feature-panel"><div className="feature-toolbar"><h2>Комментарии</h2><label>Сортировка<select className="select" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="likes">По лайкам</option><option value="popular">По популярности: лайки и ответы</option></select></label></div>
    {error && <p role="alert">{error}</p>}{sorted(comments.filter((c) => !c.parentId)).map((c) => renderComment(c))}{!comments.length && <p>Комментариев пока нет.</p>}
    {user && <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await apiClient.addComment({ caseId, authorId: user.id, authorName: user.fullName, authorRole: user.role, content: text.trim(), parentId: parentId || undefined }); setComments(await apiClient.getComments(caseId)); setText(''); setParentId('') } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}>
      {parentId && <p>Ответ на комментарий {comments.find((c) => c.id === parentId)?.authorName} <button type="button" className="btn btn-secondary btn-sm" onClick={() => setParentId('')}>Отмена</button></p>}
      <label>Ваш комментарий<textarea className="textarea" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} required /></label><button className="btn btn-primary" disabled={busy || !text.trim()}>Отправить комментарий</button>
    </form>}
  </section>
}
