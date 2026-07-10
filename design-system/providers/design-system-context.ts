"use client";

import { createContext, useContext } from "react";
import type { ThemeTokens } from "../tokens/theme/types";
import type { ColorSchemePreference, ColorSchemeKey, PortalKey } from "../tokens/types";

export interface DesignSystemContextValue {
  /** The resolved, active Theme Tokens (light/dark/future white-label). */
  theme: ThemeTokens;
  /** What the consumer asked for — may be `"system"`. */
  preference: ColorSchemePreference;
  /** What actually rendered, after resolving `"system"` against the OS. */
  resolvedColorScheme: ColorSchemeKey;
  setPreference: (preference: ColorSchemePreference) => void;
  /** The portal this subtree belongs to, for Application Token resolution (DSA §5.5). */
  portal: PortalKey;
}

export const DesignSystemContext = createContext<DesignSystemContextValue | null>(null);

export function useDesignSystem(): DesignSystemContextValue {
  const ctx = useContext(DesignSystemContext);
  if (!ctx) {
    throw new Error("useDesignSystem must be used within a <DesignSystemProvider>");
  }
  return ctx;
}
