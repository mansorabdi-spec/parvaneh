function readTokenPayload() {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return null
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export function isAdminRoleName(name) {
  return String(name || '').trim().toLowerCase() === 'admin'
}

/** True when the signed-in user is superadmin and does not also have the Admin role. */
export function viewerIsSuperAdminOnly() {
  const payload = readTokenPayload()
  if (!payload) return false
  const names = [payload.role, ...(Array.isArray(payload.roles) ? payload.roles : [])].filter(Boolean)
  return names.includes('superadmin') && !names.some(isAdminRoleName)
}
