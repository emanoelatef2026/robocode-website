import { vi } from 'vitest'

// Stub out Next.js server-only marker so tests can import server modules
vi.mock('server-only', () => ({}))

// Stub Next.js cache + navigation primitives
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect:     vi.fn(),
  notFound:     vi.fn(),
  useRouter:    vi.fn(),
  usePathname:  vi.fn(),
  useSearchParams: vi.fn(),
}))
