// Single source of truth for role labels/initials — replaces the 3 independent
// copies previously hardcoded in AdminSidebar, AdminTopbar and PortalSidebar consumers.

export type PortalRole = "super_admin" | "team_leader" | "instructor" | "parent" | "student"

export const ROLE_LABELS: Record<PortalRole, string> = {
  super_admin: "Super Admin",
  team_leader: "Team Leader",
  instructor:  "Instructor",
  parent:      "Parent",
  student:     "Student",
}

export const ROLE_PORTAL_LABELS: Record<PortalRole, string> = {
  super_admin: "Admin Portal",
  team_leader: "Team Leader Portal",
  instructor:  "Instructor Portal",
  parent:      "Parent Portal",
  student:     "Student Portal",
}

export const ROLE_INITIALS: Record<PortalRole, string> = {
  super_admin: "SA",
  team_leader: "TL",
  instructor:  "IN",
  parent:      "PA",
  student:     "ST",
}

/** Real initials from a person's name, e.g. "Jane Doe" -> "JD". Falls back to the role initials. */
export function getInitials(name: string | null | undefined, role?: PortalRole): string {
  const trimmed = name?.trim()
  if (!trimmed) return role ? ROLE_INITIALS[role] : "?"
  const parts = trimmed.split(/\s+/).slice(0, 2)
  const initials = parts.map((w) => w[0]?.toUpperCase() ?? "").join("")
  return initials || (role ? ROLE_INITIALS[role] : "?")
}
