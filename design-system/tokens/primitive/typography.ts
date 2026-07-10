/**
 * Primitive Tokens — Typography. Fills the Foundation Typography schema
 * (`foundation/typography.ts`). Family values reference the CSS custom
 * properties `next/font/google` already emits in `app/layout.tsx`
 * (`--font-orbitron`, `--font-poppins`, `--font-cairo`) — never a bare
 * family string, so a font swap stays a loader-config change only.
 */
import type { TypographyScale } from "../../foundation/typography";

export const PRIMITIVE_TYPOGRAPHY: TypographyScale = {
  family: {
    display: "var(--font-orbitron), sans-serif",
    body: "var(--font-poppins), sans-serif",
    arabic: "var(--font-cairo), 'Cairo', sans-serif",
  },
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
    "6xl": "3.75rem",
  },
  weight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.65,
    loose: 1.8,
  },
  letterSpacing: {
    tighter: "-0.02em",
    tight: "-0.01em",
    normal: "0em",
    wide: "0.01em",
    wider: "0.02em",
    widest: "0.28em",
  },
};
