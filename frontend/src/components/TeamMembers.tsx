import React from 'react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { TeamMember, User } from '../types/models'

export const TeamMembers: React.FC<{
  members: TeamMember[]
  leaderId?: string
  students?: User[]
}> = ({ members, leaderId, students = [] }) => (
  <ul className="team-members">
    {[...members]
      .sort((a, b) => Number(b.id === leaderId) - Number(a.id === leaderId))
      .map((member) => {
        const person = students.find((s) => s.id === member.id),
          name = person?.fullName || member.name,
          avatar = person?.avatar || member.avatar
        return (
          <li key={member.id}>
            <Link to={`/profile/${member.id}`} className="team-member">
              {avatar ? (
                <img src={avatar} alt="" />
              ) : (
                <span className="member-avatar" aria-hidden="true">
                  {name
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')}
                </span>
              )}
              <span className="team-member__info">
                <strong>{name}</strong>
                <small>
                  {member.id === leaderId ? (
                    <>
                      <Crown size={12} /> Капитан
                    </>
                  ) : (
                    member.role || 'Участник'
                  )}
                </small>
              </span>
            </Link>
          </li>
        )
      })}
  </ul>
)
