// Only released, actionable destinations; shared by desktop and mobile.
// Projects/competitions and optional/duplicate roadmap links stay off the menu.
export const PUBLIC_NAV_LINKS = [
  { key: "nav.home", href: "/" },
  { key: "nav.why", href: "/#why" },
  { key: "nav.programs", href: "/#programs" },
  { key: "nav.branches", href: "/#branches" },
  { key: "footer.linkContact", href: "/#contact" },
] as const;
