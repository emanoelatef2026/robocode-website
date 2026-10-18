const notify = (href?: string) => window.dispatchEvent(new CustomEvent('synthetic-navigation', { detail: href ?? 'refresh' }))
const router = { refresh: () => notify(), push: notify, replace: notify, back: () => notify('back'), forward: () => notify('forward'), prefetch: () => Promise.resolve() }
export const useRouter = () => router
export const usePathname = () => '/portal/instructor/groups/synthetic-group-1/sessions/synthetic-session-1'
export const useParams = () => ({ id: 'synthetic-group-1', sid: 'synthetic-session-1' })
export const useSearchParams = () => new URLSearchParams(window.location.search)
