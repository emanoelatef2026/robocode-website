/**
 * Flattens a Theme Token set into CSS custom properties, and back into an
 * inline style-able record. This is what makes a Theme swap a data-only
 * operation — no Component ever hardcodes a `--var` name outside this file
 * and the Semantic Token layer that names them (DSA §5.6, §5.7).
 */
import type { ThemeTokens } from "../tokens/theme/types";

const CSS_VAR_PREFIX = "--rc";

function toKebab(segments: string[]): string {
  return segments
    .join("-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function flatten(node: unknown, path: string[], out: Record<string, string>): void {
  if (node === null || node === undefined) return;
  if (typeof node === "string" || typeof node === "number") {
    out[`${CSS_VAR_PREFIX}-${toKebab(path)}`] = String(node);
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flatten(value, [...path, key], out);
    }
  }
}

/** Theme Tokens → `{ "--rc-color-bg-canvas": "#F8FAFC", ... }` */
export function themeToCssVariables(theme: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {};
  flatten({ color: theme.color, radius: theme.radius, elevation: theme.elevation }, [], out);
  return out;
}

/** Renders CSS variables as a `:root { ... }`-style declaration block string, for SSR injection. */
export function cssVariablesToDeclarationBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

/** Applies CSS variables directly to a DOM element's inline style (client-side theme switch). */
export function applyCssVariables(el: HTMLElement, vars: Record<string, string>): void {
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}
