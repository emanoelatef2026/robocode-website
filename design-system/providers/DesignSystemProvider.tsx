"use client";

/**
 * The Design System's root provider. Resolves a color-scheme preference
 * (light/dark/system) to a concrete Theme (DSA §5.6) and mounts its
 * Semantic Tokens as CSS custom properties on the subtree root, so every
 * descendant can consume `var(--rc-color-*)` without prop drilling.
 *
 * Not yet mounted in `app/layout.tsx` — integrating it platform-wide is a
 * Sprint 2+ decision once Primitives exist to consume it (see Sprint 1
 * report, "Remaining work"). Usable standalone today for isolated preview
 * (e.g. a future Storybook decorator).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DesignSystemContext } from "./design-system-context";
import { THEMES, lightTheme } from "../tokens/theme";
import { themeToCssVariables, applyCssVariables } from "../utils/css-variables";
import type { ColorSchemeKey, ColorSchemePreference, PortalKey } from "../tokens/types";

const STORAGE_KEY = "robocode-color-scheme";

function getSystemColorScheme(): ColorSchemeKey {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveScheme(preference: ColorSchemePreference): ColorSchemeKey {
  return preference === "system" ? getSystemColorScheme() : preference;
}

export interface DesignSystemProviderProps {
  children: ReactNode;
  /** Which portal this subtree serves, for future Application Token resolution (DSA §5.5). */
  portal?: PortalKey;
  /** Initial preference before localStorage hydration runs (avoids a flash on first paint). */
  defaultPreference?: ColorSchemePreference;
}

export function DesignSystemProvider({
  children,
  portal = "admin",
  defaultPreference = "light",
}: DesignSystemProviderProps) {
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(defaultPreference);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ColorSchemePreference | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      setPreferenceState(saved);
    }
  }, []);

  const resolvedColorScheme = useMemo(() => resolveScheme(preference), [preference]);
  const theme = useMemo(
    () => THEMES[resolvedColorScheme] ?? lightTheme,
    [resolvedColorScheme]
  );

  useEffect(() => {
    if (!rootRef.current) return;
    const vars = themeToCssVariables(theme);
    applyCssVariables(rootRef.current, vars);
    rootRef.current.dataset.theme = theme.colorScheme;
  }, [theme]);

  useEffect(() => {
    if (preference !== "system" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setPreferenceState("system");
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [preference]);

  const setPreference = useCallback((next: ColorSchemePreference) => {
    setPreferenceState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ theme, preference, resolvedColorScheme, setPreference, portal }),
    [theme, preference, resolvedColorScheme, setPreference, portal]
  );

  return (
    <DesignSystemContext.Provider value={value}>
      <div ref={rootRef} data-design-system-root="" data-portal={portal}>
        {children}
      </div>
    </DesignSystemContext.Provider>
  );
}
