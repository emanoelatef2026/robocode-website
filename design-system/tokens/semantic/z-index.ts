/**
 * Semantic Tokens — Z-index. Direct pass-through of the canonical
 * Primitive stacking scale — named here so components import meaning
 * ("this is a modal") rather than a bare number.
 */
import { PRIMITIVE_Z_INDEX } from "../primitive/z-index";

export const SEMANTIC_Z_INDEX = { ...PRIMITIVE_Z_INDEX } as const;
