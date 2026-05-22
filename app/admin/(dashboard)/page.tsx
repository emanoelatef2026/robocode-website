export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from "@/lib/supabase/server";
import StatCard    from "@/components/admin/StatCard";
import StatusBadge from "@/components/admin/StatusBadge";
import Link        from "next/link";

async function getStats() {
  const [bookingsRes, projectsRes, galleryRes] = await Promise.all([
    getSupabaseAdmin().from("trial_bookings").select("id, status, created_at, student_name, preferred_day").order("created_at", { ascending: false }),
    getSupabaseAdmin().from("student_projects").select("id", { count: "exact", head: true }),
    getSupabaseAdmin().from("gallery").select("id", { count: "exact", head: true }),
  ]);

  const bookings = bookingsRes.data ?? [];
  return {
    totalBookings:     bookings.length,
    newBookings:       bookings.filter((b) => b.status === "new").length,
    confirmedBookings: bookings.filter((b) => b.status === "confirmed").length,
    projectsCount:     projectsRes.count ?? 0,
    galleryCount:      galleryRes.count ?? 0,
    recentBookings:    bookings.slice(0, 8),
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Bookings"
          value={stats.totalBookings}
          accent="cyan"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          label="New (Unread)"
          value={stats.newBookings}
          accent="orange"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          }
        />
        <StatCard
          label="Projects"
          value={stats.projectsCount}
          accent="purple"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
        />
        <StatCard
          label="Gallery Images"
          value={stats.galleryCount}
          accent="green"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Recent Bookings */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#0B132B]">Recent Bookings</h2>
          <Link href="/admin/bookings" className="text-[13px] font-medium text-[#19C6F4] hover:underline">
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Preferred Day</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentBookings.map((b: {
                id: string;
                student_name: string;
                preferred_day: string | null;
                status: string;
                created_at: string;
              }) => (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3.5 font-medium text-[#0B132B]">{b.student_name}</td>
                  <td className="px-6 py-3.5 text-gray-500">{b.preferred_day ?? "—"}</td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={b.status as "new" | "contacted" | "confirmed" | "cancelled"} />
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">
                    {new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>
                </tr>
              ))}
              {stats.recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                    No bookings yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
