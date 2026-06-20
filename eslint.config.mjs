import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Large legacy codebase: `any` is used as an escape hatch in many
      // Supabase query helpers. Downgrade to warning so CI is not blocked
      // while type coverage is gradually improved.
      "@typescript-eslint/no-explicit-any": "warn",

      // React Compiler compatibility rules (eslint-plugin-react-hooks v6).
      // Full compliance requires rewriting every impure render function,
      // every setState-in-effect sync pattern, and every inline component
      // definition across the codebase — a major refactor outside this sprint.
      // Downgraded to warning to keep CI green without destructive changes.
      "react-hooks/set-state-in-effect":        "warn",
      "react-hooks/purity":                     "warn",
      "react-hooks/static-components":          "warn",
      "react-hooks/immutability":               "warn",
      "react-hooks/globals":                    "warn",
      "react-hooks/refs":                       "warn",
      "react-hooks/set-state-in-render":        "warn",
      "react-hooks/use-memo":                   "warn",
      "react-hooks/preserve-manual-memoization":"warn",
      "react-hooks/error-boundaries":           "warn",
      "react-hooks/config":                     "warn",
      "react-hooks/gating":                     "warn",
    },
  },
]);

export default eslintConfig;
