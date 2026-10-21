const PUBLIC_PAGES = new Set([
  "/", "/book-session", "/blog", "/terms-and-conditions", "/refund-policy",
  "/privacy-policy", "/login", "/forgot-password", "/reset-password",
]);

export function isPublicSitePath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || pathname.startsWith("/blog/") || pathname.startsWith("/verify/");
}
