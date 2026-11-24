import { Link } from 'react-router-dom'
import { apiRuntime } from '../api/runtime'
import { ApiImage } from './ApiImage'
import { IdentityImage } from './IdentityImage'

export function CommentAvatar({ id, name, avatar }: { id: string; name: string; avatar?: string }) {
  const base = (apiRuntime.baseUrl || '/api/v1').replace(/\/+$/, '')
  const route = `/users/${encodeURIComponent(id)}/avatar`
  const initials = <IdentityImage name={name} className="comment-avatar" />
  const photo = avatar?.startsWith('/api/v1/') ? base + avatar.slice('/api/v1'.length) : avatar
  const fallback = photo?.startsWith(base + '/') ? (
    <ApiImage
      src={photo}
      className="comment-avatar"
      alt=""
      fallback={initials}
      placeholder={initials}
    />
  ) : (
    <IdentityImage name={name} src={photo} className="comment-avatar" />
  )
  if (apiRuntime.mode === 'mock' || !id || photo?.startsWith(base + route)) return fallback
  return (
    <ApiImage
      src={base + route}
      className="comment-avatar"
      alt=""
      fallback={fallback}
      placeholder={initials}
    />
  )
}

export function CommentAuthor({
  id,
  name,
  avatar,
  to,
}: {
  id: string
  name: string
  avatar?: string
  to?: string
}) {
  const content = (
    <>
      <CommentAvatar id={id} name={name} avatar={avatar} />
      {name}
    </>
  )
  return to ? (
    <Link className="comment-author" to={to}>
      {content}
    </Link>
  ) : (
    <span className="comment-author">{content}</span>
  )
}
