export type Locale = "en" | "ar";
export type Dir    = "ltr" | "rtl";

export function getDir(locale: Locale): Dir {
  return locale === "ar" ? "rtl" : "ltr";
}

export function resolvePath(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let node: unknown = obj;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}
