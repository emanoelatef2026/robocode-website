import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-[#FF8A1F]">404</p>
        <h1 className="mt-4 text-xl font-semibold text-[#0B1F3A]">Page not found</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#FF8A1F]"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
