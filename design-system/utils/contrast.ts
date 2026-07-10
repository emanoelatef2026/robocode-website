/**
 * WCAG contrast helpers — DSA §13 "Contrast": 4.5:1 body text / 3:1 large
 * text and icons, enforced at the Token layer so no Component can be built
 * with a non-compliant Semantic Token pairing.
 */

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [channel(r), channel(g), channel(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG 2.1 contrast ratio between two hex colors, 1–21. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastLevel = "body" | "large-text";

const AA_THRESHOLD: Record<ContrastLevel, number> = {
  body: 4.5,
  "large-text": 3,
};

/** DSA §13 pass/fail check for a foreground/background Semantic Token pairing. */
export function meetsContrastAA(hexA: string, hexB: string, level: ContrastLevel = "body"): boolean {
  return contrastRatio(hexA, hexB) >= AA_THRESHOLD[level];
}
