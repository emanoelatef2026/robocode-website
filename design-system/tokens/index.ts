/**
 * Token Architecture barrel — DSA §5.
 *
 * Primitive → Semantic → Component → Application → Theme. See each
 * sub-folder for the layer it implements.
 */

export * from "./types";
export * as primitive from "./primitive";
export * from "./semantic";
export * from "./component";
export * from "./application";
export * from "./theme";
