"use client";

import { useDesignSystem } from "./design-system-context";

/** Convenience accessor — most consumers only need the resolved theme + setter. */
export function useTheme() {
  const { theme, preference, resolvedColorScheme, setPreference } = useDesignSystem();
  return { theme, preference, resolvedColorScheme, setPreference };
}
