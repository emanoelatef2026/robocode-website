/**
 * Foundation — Grid category.
 *
 * Answers: "how does content align and flow across viewport widths?" One
 * grid category serves both Admin/HQ's wide multi-column tables and
 * Instructor/Parent/Student's strict single-column flow (blueprint §16.4)
 * by parameterizing column count per breakpoint. See DSA §4 "Grid".
 */
import type { KeyOf, Scale } from "./types";
import type { BreakpointKey } from "./breakpoints";

export const GRID_GUTTER_KEYS = ["compact", "comfortable", "spacious"] as const;
export type GridGutterKey = KeyOf<typeof GRID_GUTTER_KEYS>;

/** Max column count available at each breakpoint. */
export type GridColumns = Record<BreakpointKey, number>;

export interface GridScale {
  columns: GridColumns;
  gutter: Scale<GridGutterKey>;
  margin: Scale<GridGutterKey>;
}
