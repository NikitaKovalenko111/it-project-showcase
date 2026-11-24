import { apiRuntime } from '../api/runtime'
import { useAppSelector } from '../store'
import type { Company } from '../types/models'
import { IdentityImage } from './IdentityImage'
import { useProtectedImage } from './useProtectedImage'

export function CompanyLogo({
  company,
  src = company?.logo,
  name = company?.shortName || company?.name || '',
  className,
}: {
  company?: Company
  src?: string
  name?: string
  className: string
}) {
  const viewer = useAppSelector((state) => state.auth.currentUser)
  const live = apiRuntime.mode === 'live'
  const privateLogo = live && company && !company.isVerified
  const mayReadPrivate =
    viewer?.role === 'admin' || viewer?.companyProfile?.companyId === company?.id
  const privatePath =
    privateLogo && mayReadPrivate && company.logoFileId ? `/files/${company.logoFileId}` : undefined
  const protectedSrc = useProtectedImage(privatePath, viewer?.id)
  const defaultBase = '/api/v1'
  const publicSrc =
    live && src?.startsWith(`${defaultBase}/companies/`)
      ? `${apiRuntime.baseUrl || defaultBase}${src.slice(defaultBase.length)}`
      : src
  const logo = privateLogo ? protectedSrc : publicSrc
  return <IdentityImage key={logo} src={logo} name={name} className={className} />
}
