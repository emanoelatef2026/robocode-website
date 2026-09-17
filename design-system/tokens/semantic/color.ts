/**
 * Semantic Tokens — Color.
 *
 * Purpose-named references to Primitive color values (DSA §5.3). Includes
 * the six `StatusBadge` semantic buckets (DESIGN.md §3) — the existence
 * proof this architecture formalizes: reuse a bucket by meaning, never
 * invent a new bg/text/dot triple (DESIGN.md rule, restated here as the
 * Semantic layer's binding contract).
 */
import { PRIMITIVE_COLOR } from "../primitive/color";

export const STATUS_BUCKET_KEYS = ["success", "warning", "danger", "info", "neutral", "special"] as const;
export type StatusBucketKey = (typeof STATUS_BUCKET_KEYS)[number];

export interface StatusColorTriple {
  bg: string;
  text: string;
  dot: string;
}

export const SEMANTIC_STATUS_COLOR: Record<StatusBucketKey, StatusColorTriple> = {
  success: { bg: PRIMITIVE_COLOR.greenSoft, text: PRIMITIVE_COLOR.greenDark, dot: PRIMITIVE_COLOR.green },
  warning: { bg: PRIMITIVE_COLOR.amberSoft, text: PRIMITIVE_COLOR.amberDark, dot: PRIMITIVE_COLOR.amber },
  danger: { bg: PRIMITIVE_COLOR.redSoft, text: PRIMITIVE_COLOR.redDark, dot: PRIMITIVE_COLOR.red },
  info: { bg: PRIMITIVE_COLOR.blueSoft, text: PRIMITIVE_COLOR.blueDark, dot: PRIMITIVE_COLOR.blue },
  neutral: { bg: PRIMITIVE_COLOR.slateSoft, text: PRIMITIVE_COLOR.slateDark, dot: PRIMITIVE_COLOR.slate },
  special: { bg: PRIMITIVE_COLOR.orangeSoft, text: PRIMITIVE_COLOR.orangeStrongHover, dot: PRIMITIVE_COLOR.orangeStrong },
};

export interface SemanticColorTokens {
  bg: { canvas: string; card: string; muted: string; strong: string };
  border: { default: string; strong: string; soft: string };
  text: { primary: string; secondary: string; tertiary: string; muted: string; mutedSoft: string; onBrand: string };
  brand: { primary: string; primaryHover: string; accent: string; accentStrong: string; accentStrongHover: string; accentSoft: string; secondary: string; secondaryStrong: string };
  status: Record<StatusBucketKey, StatusColorTriple>;
  interactive: { focusRing: string; disabled: string };
}

/** Today's one shipped Theme (DESIGN.md's palette). See `tokens/theme/light.ts`. */
export const LIGHT_SEMANTIC_COLOR: SemanticColorTokens = {
  bg: { canvas: PRIMITIVE_COLOR.bg, card: PRIMITIVE_COLOR.bgCard, muted: PRIMITIVE_COLOR.bgMuted, strong: PRIMITIVE_COLOR.bgStrong },
  border: { default: PRIMITIVE_COLOR.border, strong: PRIMITIVE_COLOR.borderStrong, soft: PRIMITIVE_COLOR.borderSoft },
  text: {
    primary: PRIMITIVE_COLOR.text,
    secondary: PRIMITIVE_COLOR.text2,
    tertiary: PRIMITIVE_COLOR.text3,
    muted: PRIMITIVE_COLOR.muted,
    mutedSoft: PRIMITIVE_COLOR.mutedSoft,
    onBrand: PRIMITIVE_COLOR.white,
  },
  brand: {
    primary: PRIMITIVE_COLOR.navy,
    primaryHover: PRIMITIVE_COLOR.navyLight,
    accent: PRIMITIVE_COLOR.orange,
    accentStrong: PRIMITIVE_COLOR.orangeStrong,
    accentStrongHover: PRIMITIVE_COLOR.orangeStrongHover,
    accentSoft: PRIMITIVE_COLOR.orangeSoft,
    secondary: PRIMITIVE_COLOR.cyan,
    secondaryStrong: PRIMITIVE_COLOR.cyanStrong,
  },
  status: SEMANTIC_STATUS_COLOR,
  interactive: { focusRing: "rgba(14,116,144,.18)", disabled: PRIMITIVE_COLOR.mutedSoft },
};

/**
 * First-pass Dark Theme. Structurally complete (every key `LIGHT_SEMANTIC_COLOR`
 * defines is present) but not yet visually reviewed — visual polish is
 * `DESIGN.md`'s domain (Architecture Closure v1 §10, "Explicitly NOT Frozen").
 * Real usage condition: an Instructor in a projector-dimmed classroom, or a
 * Parent checking a balance at night (DSA §5.6).
 */
export const DARK_SEMANTIC_COLOR: SemanticColorTokens = {
  bg: { canvas: "#0A1526", card: "#0F1F38", muted: "#132A4A", strong: "#1E3A5F" },
  border: { default: "#1E3A5F", strong: "#3E5B7B", soft: "#17304F" },
  text: {
    primary: "#F1F5F9",
    secondary: "#CBD5E1",
    tertiary: "#94A3B8",
    muted: "#94A3B8",
    mutedSoft: "#64748B",
    onBrand: "#0B1220",
  },
  brand: {
    primary: "#38BDF8",
    primaryHover: "#7DD3FC",
    accent: PRIMITIVE_COLOR.orange,
    accentStrong: "#FFB15A",
    accentStrongHover: "#FFCB83",
    accentSoft: PRIMITIVE_COLOR.orangeSoft,
    secondary: PRIMITIVE_COLOR.cyan,
    secondaryStrong: "#67E8F9",
  },
  status: {
    success: { bg: "#0F2E20", text: "#4ADE80", dot: PRIMITIVE_COLOR.green },
    warning: { bg: "#332108", text: "#FBBF24", dot: PRIMITIVE_COLOR.amber },
    danger: { bg: "#33131A", text: "#F87171", dot: PRIMITIVE_COLOR.red },
    info: { bg: "#0C2A3D", text: "#7DD3FC", dot: PRIMITIVE_COLOR.blue },
    neutral: { bg: "#1E293B", text: "#CBD5E1", dot: PRIMITIVE_COLOR.slate },
    special: { bg: "#2E1B47", text: "#D8B4FE", dot: PRIMITIVE_COLOR.purple },
  },
  interactive: { focusRing: "rgba(103,232,249,.32)", disabled: "#475569" },
};
