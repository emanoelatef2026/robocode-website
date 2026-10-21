import Link from 'next/link'
import styles from '@/components/public-site/PublicSiteTheme.module.css'

export default function NotFound() {
  return (
    <div data-public-site className={`${styles.site} flex min-h-screen items-center justify-center bg-[var(--bg)] px-4`}>
      <div className="text-center">
        <p className="text-5xl font-bold text-[var(--orange-strong)]">404</p>
        <h1 className="mt-4 text-xl font-semibold text-[var(--navy)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--text-3)]">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-[var(--navy)] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--orange-strong)]"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
