/**
 * Primitive Tokens — Color.
 *
 * Raw, meaningless-in-isolation hex values. Sourced verbatim from
 * `DESIGN.md` §3, today's one shipped Theme. Never import this file from a
 * Screen or Component directly — only Semantic Tokens (`tokens/semantic`)
 * may reference these (DSA §5.2, §5.7).
 */

export const PRIMITIVE_COLOR = {
  navy950: "#07182D",
  navy: "#0B1F3A",
  navyLight: "#163560",
  navyMarketing: "#0B2341",
  orange: "#FF8A1F",
  orangeStrong: "#C2410C",
  orangeStrongHover: "#9A3412",
  orangeSoft: "#FFB15A",
  cyan: "#10B6D3",
  cyanStrong: "#0E7490",

  green: "#10B981",
  greenSoft: "#E7F8EE",
  greenDark: "#166534",
  greenIndicator: "#16A34A",
  amber: "#F59E0B",
  amberSoft: "#FFF7E6",
  amberSoft2: "#FFF1E2",
  amberDark: "#92400E",
  red: "#EF4444",
  redSoft: "#FEECEC",
  redDark: "#991B1B",
  blue: "#0E7490",
  blueSoft: "#E6F6FB",
  blueDark: "#155E75",
  purple: "#A855F7",
  purpleSoft: "#F3E8FF",
  purpleDark: "#6B21A8",
  slate: "#94A3B8",
  slateSoft: "#F1F5F9",
  slateDark: "#475569",

  bg: "#F5F7FA",
  bgCard: "#FFFFFF",
  bgMuted: "#F1F5F9",
  bgStrong: "#E7EDF4",
  border: "#D7E0EA",
  borderStrong: "#94A3B8",
  borderSoft: "#EDF1F5",

  text: "#0F172A",
  text2: "#334155",
  text3: "#475569",
  muted: "#64748B",
  mutedSoft: "#94A3B8",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export type PrimitiveColorKey = keyof typeof PRIMITIVE_COLOR;
