import { apiRuntime } from '../api/runtime'
import { useAppSelector } from '../store'
import { IdentityImage } from './IdentityImage'
import { useProtectedImage } from './useProtectedImage'

export function UserAvatar({
  userId,
  src,
  name,
  className,
}: {
  userId?: string
  src?: string
  name: string
  className: string
}) {
  const viewer = useAppSelector((state) => state.auth.currentUser)
  const path = userId ? `/users/${encodeURIComponent(userId)}/avatar` : undefined
  const defaultBase = '/api/v1'
  const versionedPath =
    path && src?.startsWith(`${defaultBase}${path}?`) ? src.slice(defaultBase.length) : path
  const live = apiRuntime.mode === 'live'
  const authenticated = live && Boolean(viewer && (viewer.id === userId || viewer.role === 'admin'))
  const protectedSrc = useProtectedImage(authenticated ? versionedPath : undefined, viewer?.id)

  let avatar = src
  if (live) {
    avatar = versionedPath ? `${apiRuntime.baseUrl || defaultBase}${versionedPath}` : undefined
    if (authenticated) {
      avatar = protectedSrc
    }
  }
  return <IdentityImage key={avatar} src={avatar} name={name} className={className} />
}
