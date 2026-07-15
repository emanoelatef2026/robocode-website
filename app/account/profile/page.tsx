import Image from "next/image"
import Link from "next/link"
import { requireAuth } from "@/modules/rbac/guards"
import { ROLE_PORTAL_MAP } from "@/types/enums"
import { ROLE_LABELS, getInitials, type PortalRole } from "@/components/shared/layout/roles"

export default async function ProfilePage() {
  const user = await requireAuth()
  const role = user.globalRole as PortalRole
  const roleLabel = ROLE_LABELS[role] ?? user.globalRole
  const initials = getInitials(user.email, role)

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>

          <div className="mb-6 flex flex-col items-center">
            <div
              className="mb-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#FF8A1F,#0B1F3A)" }}
            >
              {initials}
            </div>
            <h1 className="text-center text-lg font-bold text-[#0B132B]">{roleLabel}</h1>
            <p className="text-center text-[13px] text-[#9CA3AF]">{user.email}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Email</span>
              <span className="text-[13px] font-medium text-[#0B132B]">{user.email}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Role</span>
              <span className="text-[13px] font-medium text-[#0B132B]">{roleLabel}</span>
            </div>
          </div>

          <Link
            href="/account/password"
            className="mt-5 block w-full rounded-lg bg-[#0B132B] py-3 text-center text-[14px] font-semibold text-white transition hover:bg-[#FF8A1F]"
          >
            Change Password
          </Link>

          <div className="mt-5 text-center">
            <Link href={ROLE_PORTAL_MAP[user.globalRole]} className="text-[13px] text-[#64748B] hover:underline">
              ← Back to portal
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center text-[12px] text-[#9CA3AF]">Robocode School · LMS</p>
      </div>
    </div>
  )
}
