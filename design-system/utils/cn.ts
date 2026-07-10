/**
 * Class-name join utility. No `clsx`/`tailwind-merge` dependency exists in
 * the repo today (verified against package.json) — this is a minimal,
 * dependency-free equivalent covering the string/conditional/falsy cases
 * every Primitive will need starting Sprint 2.
 */
export type ClassValue = string | number | null | undefined | false | Record<string, boolean | undefined>;

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      continue;
    }
    for (const key in value) {
      if (value[key]) classes.push(key);
    }
  }
  return classes.join(" ");
}
