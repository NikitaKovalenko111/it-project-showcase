import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../../store'
import type { UserRole } from '../../types/models'

export const RoleGuard: React.FC<{ roles: UserRole[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { currentUser } = useAppSelector((s) => s.auth)
  return currentUser && roles.includes(currentUser.role) ? <>{children}</> : <Navigate to="/" replace />
}
