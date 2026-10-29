import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// jsdom does not implement the native dialog methods used by the browser modal.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
}

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
