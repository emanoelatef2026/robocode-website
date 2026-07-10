/**
 * Robocode Design System — root barrel.
 *
 * Layer order (`docs/design/design-system-architecture.md` §3):
 * Foundation → Tokens → Primitives → Patterns → Components → Templates →
 * Screens → Applications. This package implements Foundation, Tokens, and
 * the Primitive Component Library (Sprint 1 + Sprint 2) plus the
 * cross-cutting Provider/Utility/Accessibility layers every Primitive sits
 * on top of.
 *
 * Import from the sub-path you need (`@/design-system/tokens`,
 * `@/design-system/foundation`, `@/design-system/primitives/Button`, ...)
 * where possible — this root barrel is provided for convenience and stays
 * tree-shakable because every export below is named, never a default or a
 * side-effecting module.
 */

export * as foundation from "./foundation";
export * from "./tokens";
export * from "./providers";
export * from "./utils";
export * from "./a11y";
export * from "./conventions";
export * from "./primitives";
