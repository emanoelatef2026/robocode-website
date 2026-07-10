/**
 * Naming and folder conventions, as machine-checkable code rather than
 * prose — the frozen rulings in `docs/design/product-blueprint.md` §18 and
 * `docs/design/architecture-closure-v1.md` CLS-C4(a)/(b), transcribed into
 * validators a future lint rule or CI check (Architecture Closure v1
 * Decision 6, near-term backlog) can call directly instead of re-deriving.
 * This file makes no new architectural decisions — architecture is frozen.
 */

// ── Naming patterns (blueprint §18) ─────────────────────────────────────────

export const NAMING_PATTERN = {
  /** Routes: kebab-case. */
  route: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  /** Components/Dialogs/Forms/Tables: PascalCase. */
  component: /^[A-Z][a-zA-Z0-9]*$/,
  /** Hooks: `use{Noun}` or `use{Verb}{Noun}`. */
  hook: /^use[A-Z][a-zA-Z0-9]*$/,
  /** Server actions: `{verb}{Entity}Action`. */
  serverAction: /^[a-z][a-zA-Z0-9]*Action$/,
  /** Forms: `{Entity}Form`. */
  form: /^[A-Z][a-zA-Z0-9]*Form$/,
} as const;

export type NamingCategory = keyof typeof NAMING_PATTERN;

export function matchesNamingConvention(category: NamingCategory, value: string): boolean {
  return NAMING_PATTERN[category].test(value);
}

// ── The mechanical fork test (Architecture Closure v1, CLS-C4(a)) ──────────

/**
 * "Remove every permission difference between the two roles viewing the
 * candidate component. Does the component still need to be a separate
 * file?" Encoded as a decision function so the question is asked the same
 * way every session — the answer itself is always a human/AI judgment
 * call, this only fixes the question's shape.
 */
export interface ForkTestInput {
  /** True if, once permission differences are removed, the two components still differ structurally. */
  structurallyDistinctIgnoringPermissions: boolean;
  /** True if the candidate still composes from the same underlying Primitives/Patterns/Business Components. */
  composesFromSameFoundation: boolean;
}

export function isLegitimateRoleSpecificComponent(input: ForkTestInput): boolean {
  return input.structurallyDistinctIgnoringPermissions && input.composesFromSameFoundation;
}

// ── Folder conventions (DSA §2 Library Architecture layer names) ───────────

export const LIBRARY_LAYER_KEYS = [
  "foundation", // Primitives proper — Button, Input, Icon...
  "compositions", // 2-4 Primitives, domain-free
  "patterns", // behavior contracts
  "businessComponents", // entity-aware, one per entity concern
  "templates", // structural screen shapes
  "pages", // real routes
] as const;
export type LibraryLayerKey = (typeof LIBRARY_LAYER_KEYS)[number];

/** Where each layer's source lives once Sprint 2+ starts building it. Declared now so folder placement is never an ad hoc call. */
export const LIBRARY_LAYER_FOLDER: Record<LibraryLayerKey, string> = {
  foundation: "design-system/primitives",
  compositions: "design-system/compositions",
  patterns: "design-system/patterns",
  businessComponents: "components", // colocated per business domain, per blueprint §18's existing convention
  templates: "design-system/templates",
  pages: "app",
};

// ── Component Taxonomy registry (component-library-specification.md §3) ────

export const COMPONENT_TAXONOMY_CATEGORIES = [
  "foundation", "layout", "navigation", "dataEntry", "dataDisplay",
  "dataVisualization", "feedback", "overlay", "workspace", "search",
  "filtering", "communication", "authentication", "education", "finance",
  "crm", "analytics", "portfolio", "certificates", "utilities",
] as const;
export type ComponentTaxonomyCategory = (typeof COMPONENT_TAXONOMY_CATEGORIES)[number];
