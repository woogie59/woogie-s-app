// Shared helper functions for session & pack calculations

export const getRemainingSessions = (user) => {
  if (!user || !user.session_packs) return 0
  return user.session_packs.reduce((acc, pack) => {
    return acc + (pack.total_count + pack.service_count - pack.used_count)
  }, 0)
}

export const getCurrentActivePack = (user) => {
  if (!user || !user.session_packs) return null
  const activePacks = user.session_packs.filter(
    (p) => p.total_count + p.service_count > p.used_count,
  )
  return activePacks.length > 0 ? activePacks[0] : null
}

export const formatDate = (date) => date.toISOString().split('T')[0]

