export type RepresentativeProfile = {
  name: string
  position: string
  bio: string
  expertise: string
}

const profileKey = (userId: string) => `uust:representative-profile:${userId}`
const mentorsKey = (companyId: string) => `uust:company-mentors:${companyId}`

export function getRepresentativeProfile(userId: string): RepresentativeProfile | undefined {
  const raw = localStorage.getItem(profileKey(userId))
  if (!raw) return undefined
  try {
    const profile = JSON.parse(raw)
    if (
      profile &&
      ['name', 'position', 'bio', 'expertise'].every((field) => typeof profile[field] === 'string')
    )
      return profile
  } catch {
    // An invalid local record can be replaced by saving the form again.
  }
}

export function saveRepresentativeProfile(userId: string, profile: RepresentativeProfile) {
  const saved = {
    name: profile.name.trim(),
    position: profile.position.trim(),
    bio: profile.bio.trim(),
    expertise: profile.expertise.trim(),
  }
  localStorage.setItem(profileKey(userId), JSON.stringify(saved))
  return saved
}

function mentorIds(companyId: string): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(mentorsKey(companyId)) || '[]')
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function getCompanyMentors(companyId: string) {
  return mentorIds(companyId).flatMap((id) => {
    const profile = getRepresentativeProfile(id)
    return profile?.name && (profile.bio || profile.expertise) ? [{ id, ...profile }] : []
  })
}

export function setCompanyMentor(companyId: string, userId: string, visible: boolean) {
  const ids = new Set(mentorIds(companyId))
  if (visible) ids.add(userId)
  else ids.delete(userId)
  localStorage.setItem(mentorsKey(companyId), JSON.stringify([...ids]))
}
