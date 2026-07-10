/**
 * Primitive Tokens — Color.
 *
 * Raw, meaningless-in-isolation hex values. Sourced verbatim from
 * `DESIGN.md` §3, today's one shipped Theme. Never import this file from a
 * Screen or Component directly — only Semantic Tokens (`tokens/semantic`)
 * may reference these (DSA §5.2, §5.7).
 */

export const PRIMITIVE_COLOR = {
  navy: "#0B1F3A",
  navyLight: "#163560",
  navyMarketing: "#0B2341",
  orange: "#FF8A1F",
  orangeSoft: "#FFB15A",
  cyan: "#38BDF8",

  green: "#10B981",
  greenSoft: "#E7F8EE",
  greenDark: "#15803D",
  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  amberSoft2: "#FFF1E2",
  amberDark: "#B45309",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  redDark: "#B91C1C",
  blue: "#38BDF8",
  blueSoft: "#E0F2FE",
  blueDark: "#0369A1",
  purple: "#A855F7",
  purpleSoft: "#F3E8FF",
  purpleDark: "#6B21A8",
  slate: "#94A3B8",
  slateSoft: "#F1F5F9",
  slateDark: "#475569",

  bg: "#F8FAFC",
  bgCard: "#FFFFFF",
  bgMuted: "#F1F5F9",
  border: "#E2E8F0",
  borderSoft: "#e7ebf1",

  text: "#0F172A",
  text2: "#334155",
  text3: "#475569",
  muted: "#64748B",
  mutedSoft: "#94A3B8",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export type PrimitiveColorKey = keyof typeof PRIMITIVE_COLOR;
