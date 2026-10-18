// Standalone QA only. Never move this harness into an app route.
import { createServer } from 'vite'
import tailwindcss from '@tailwindcss/postcss'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))
const repo = path.resolve(root, '../../..')
const local = name => path.join(root, name)
const server = await createServer({
  configFile: false,
  envFile: false,
  root,
  cacheDir: local('.vite'),
  publicDir: false,
  resolve: {
    alias: [
      { find: '@/modules/instructor-portal/actions', replacement: local('actions.ts') },
      { find: 'next/link', replacement: local('link.tsx') },
      { find: 'next/navigation', replacement: local('navigation.ts') },
      { find: '@', replacement: repo },
    ],
    dedupe: ['react', 'react-dom'],
  },
  esbuild: { jsx: 'automatic' },
  css: { postcss: { plugins: [tailwindcss({ base: repo })] } },
  plugins: [{
    name: 'synthetic-client-only',
    enforce: 'pre',
    transform(source, id) {
      // Fail closed if a client dependency unexpectedly pulls in a real backend.
      if (id.includes('/node_modules/')) return
      if (/^\s*['"]use server['"]/m.test(source) || /(?:from\s*|import\s*)['"](?:server-only|@supabase\/|@\/lib\/(?:supabase|env)|next\/headers)/.test(source)) {
        throw new Error(`Backend dependency is forbidden in the synthetic QA harness: ${id}`)
      }
    },
    configureServer(vite) {
      vite.middlewares.use((_req, res, next) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:4175; form-action 'none'; frame-src 'none'")
        next()
      })
    },
  }],
  server: { host: 'localhost', port: 4175, strictPort: true, fs: { allow: [repo] } },
})
await server.listen()
console.log('Synthetic QA only: http://localhost:4175')
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await server.close(); process.exit(0) })
}
