import type { PortalNavSection } from "@/components/shared/sidebar/PortalSidebar"

/**
 * Derives a page title from the portal's own nav config instead of a
 * hand-maintained path→title lookup table. The longest matching href wins,
 * so nested detail routes inherit their parent section's label.
 */
export function derivePageTitle(pathname: string, sections: PortalNavSection[], fallback = "Dashboard"): string {
  const items = sections.flatMap((s) => s.items)

  const exact = items.find((i) => i.href.split("?")[0] === pathname)
  if (exact) return exact.label

  const byLength = [...items].sort((a, b) => b.href.length - a.href.length)
  for (const item of byLength) {
    const hrefPath = item.href.split("?")[0]
    if (hrefPath !== "" && pathname.startsWith(hrefPath + "/")) return item.label
  }

  return fallback
}
