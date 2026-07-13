// Vitest resolve.alias target for Next.js's `server-only` / `client-only`
// marker packages. These packages are never installed as real dependencies —
// Next's own webpack build aliases them to its internal compiled copies
// (next/dist/compiled/server-only/*) instead of requiring them in
// node_modules. Vite/Vitest has no equivalent built-in alias, so we point the
// bare specifier here directly, mirroring the same pattern Next's own
// `next/jest` preset uses (moduleNameMapper -> __mocks__/empty.js).
export {}
