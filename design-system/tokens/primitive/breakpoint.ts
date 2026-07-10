/**
 * Primitive Tokens — Breakpoint. Fills the Foundation Breakpoints schema
 * (`foundation/breakpoints.ts`), matching blueprint §16.1's three-tier
 * split plus a "wide" tier for dense HQ analytical surfaces.
 */
import type { BreakpointScale } from "../../foundation/breakpoints";

export const PRIMITIVE_BREAKPOINT: BreakpointScale = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
};
