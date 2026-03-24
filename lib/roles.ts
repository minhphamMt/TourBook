export const managementRoles = ["staff", "admin", "super_admin"] as const

export type ManagementRole = (typeof managementRoles)[number]
export type RoleName = "customer" | ManagementRole

const rolePriority: RoleName[] = ["super_admin", "admin", "staff", "customer"]

export function normalizeRoles(roles: string[]): RoleName[] {
  const lowered = roles.map((role) => role.toLowerCase()).filter((role): role is RoleName => rolePriority.includes(role as RoleName))
  return Array.from(new Set(lowered)).sort((left, right) => rolePriority.indexOf(left) - rolePriority.indexOf(right))
}

export function getPrimaryRole(roles: string[]): RoleName {
  return normalizeRoles(roles)[0] || "customer"
}

export function isManagementRole(role: string | null | undefined): role is ManagementRole {
  return managementRoles.includes((role || "") as ManagementRole)
}

export function hasManagementRole(roles: string[]) {
  return normalizeRoles(roles).some((role) => isManagementRole(role))
}

export function resolvePostLoginPath(roles: string[], redirectTo?: string) {
  if (hasManagementRole(roles)) {
    return "/admin"
  }

  if (redirectTo?.startsWith("/admin")) {
    return "/account"
  }

  return redirectTo || "/account"
}
