/**
 * Foundation layer — shared type utilities.
 *
 * Per `docs/design/design-system-architecture.md` §3.1, Foundation defines
 * *which categories* of design decisions exist; it never carries values.
 * Every category file in this folder exports a scale of *keys* (a schema)
 * that the Token layer (`design-system/tokens/primitive`) fills with values.
 */

/** A scale is an ordered set of keys mapped to a value of type `T`. */
export type Scale<Key extends string, T = string> = Record<Key, T>;

/** Utility to derive a union of literal keys from a readonly tuple. */
export type KeyOf<Keys extends readonly string[]> = Keys[number];
