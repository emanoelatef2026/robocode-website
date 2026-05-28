import Link from 'next/link'

export default function InstructorHomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0B132B]">Instructor Portal</h1>
        <p className="mt-2 text-gray-400">Dashboard coming in a future phase.</p>
        <Link
          href="/account/password"
          className="mt-4 inline-block text-sm text-[#FF8A1F] hover:underline"
        >
          Settings → Change Password
        </Link>
      </div>
    </div>
  )
}
