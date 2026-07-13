import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

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
