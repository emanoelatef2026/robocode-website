/** Shared size scale used by every sizeable Primitive in this catalog. */
export const PRIMITIVE_SIZE_KEYS = ["sm", "md", "lg"] as const;
export type PrimitiveSize = (typeof PRIMITIVE_SIZE_KEYS)[number];

/** The six Semantic status buckets (`tokens/semantic/color.ts`), reused by Badge/Avatar status. */
export const PRIMITIVE_TONE_KEYS = ["success", "warning", "danger", "info", "neutral", "special"] as const;
export type PrimitiveTone = (typeof PRIMITIVE_TONE_KEYS)[number];
