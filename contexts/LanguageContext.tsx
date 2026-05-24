"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import enDict from "@/messages/en.json";
import arDict from "@/messages/ar.json";
import { type Dir, type Locale, getDir, resolvePath } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  locale:    Locale;
  dir:       Dir;
  setLocale: (l: Locale) => void;
  t:         (key: string) => string;
}

// ── Context ───────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  locale:    "en",
  dir:       "ltr",
  setLocale: () => {},
  t:         (k) => k,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Hydrate from localStorage once mounted
  useEffect(() => {
    const saved = localStorage.getItem("robocode-locale") as Locale | null;
    if (saved === "ar" || saved === "en") setLocaleState(saved);
  }, []);

  // Sync DOM attributes and body font class on every locale change
  useEffect(() => {
    const dir = getDir(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir  = dir;

    if (locale === "ar") {
      document.body.classList.add("font-cairo");
    } else {
      document.body.classList.remove("font-cairo");
    }

    localStorage.setItem("robocode-locale", locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback(
    (key: string): string => {
      const dict = locale === "ar"
        ? (arDict as Record<string, unknown>)
        : (enDict as Record<string, unknown>);
      return resolvePath(dict, key);
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, dir: getDir(locale), setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLanguage() {
  return useContext(LanguageContext);
}
