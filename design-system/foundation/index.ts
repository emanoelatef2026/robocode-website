/**
 * Foundation layer barrel — DSA §4.
 *
 * Re-exports every category's key scale and type contract. Foundation never
 * exports values (see `docs/design/design-system-architecture.md` §4) — the
 * Token layer (`design-system/tokens`) is where those contracts are filled.
 */

export * from "./types";
export * from "./spacing";
export * from "./typography";
export * from "./grid";
export * from "./elevation";
export * from "./radius";
export * from "./opacity";
export * from "./sizing";
export * from "./motion";
export * from "./breakpoints";
export * from "./density";
export * from "./iconography";
export * from "./illustrations";
export * from "./z-index";
export * from "./timing";
