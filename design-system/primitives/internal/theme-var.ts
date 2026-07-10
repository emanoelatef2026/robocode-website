/**
 * Bridges a Semantic Token's runtime CSS custom property — mounted by
 * `DesignSystemProvider` on `[data-design-system-root]` (DSA §5.6,
 * `utils/css-variables.ts`) — to a literal fallback so a Primitive renders
 * correctly under today's one shipped Theme even on a subtree the Provider
 * hasn't wrapped yet (Sprint 1 report: "not yet mounted in app/layout.tsx").
 * The fallback must always be the current Light Theme value for the same
 * Semantic Token — never a new, undocumented color.
 */
export function themeVar(cssVariableName: `--rc-${string}`, fallback: string): string {
  return `var(${cssVariableName}, ${fallback})`;
}
