/**
 * Primitive Tokens — Z-index. Fills the Foundation Z-index schema
 * (`foundation/z-index.ts`) with the canonical, product-wide stacking
 * order (DSA §4 "Z-index"). This is the single source every Overlay
 * category component must reference.
 */
import type { ZIndexScale } from "../../foundation/z-index";

export const PRIMITIVE_Z_INDEX: ZIndexScale = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  backdrop: 1200,
  drawer: 1300,
  modal: 1400,
  popover: 1500,
  toast: 1600,
  commandPalette: 1700,
  tooltip: 1800,
};
