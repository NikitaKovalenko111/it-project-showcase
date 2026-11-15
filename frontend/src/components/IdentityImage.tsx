import { useState } from 'react'

export function IdentityImage({
  src,
  name,
  className,
}: {
  src?: string
  name: string
  className: string
}) {
  const [failedSrc, setFailedSrc] = useState<string>()
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
  return src && src !== failedSrc ? (
    <img className={className} src={src} alt="" onError={() => setFailedSrc(src)} />
  ) : (
    <span className={`${className} identity-placeholder`} aria-hidden="true">
      {initials || '•'}
    </span>
  )
}
