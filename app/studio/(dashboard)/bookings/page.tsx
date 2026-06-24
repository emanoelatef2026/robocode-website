"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/studio/StatusBadge";

type Status = "new" | "contacted" | "confirmed" | "cancelled";

interface Booking {
  id: string;
  student_name: string;
  age: number | null;
  school: string | null;
  phone: string;
  another_phone: string | null;
  preferred_day: string | null;
  preferred_time: string | null;
  notes: string | null;
  status: Status;
  created_at: string;
}

const STATUSES: Status[] = ["new", "contacted", "confirmed", "cancelled"];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/bookings")
      .then((r) => r.json())
      .then((data) => { setBookings(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateStatus = async (id: string, status: Status) => {
    setUpdating(id);
    const res = await fetch(`/api/studio/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#19C6F4] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-[#9CA3AF]">{bookings.length} total submissions</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#F1F5F9] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="ds-table-head">
              <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Age</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Day / Time</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((b) => (
                <>
                  <tr
                    key={b.id}
                    className="cursor-pointer hover:bg-[#F9FAFB]/60"
                    onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                  >
                    <td className="px-5 py-3.5 font-medium text-[#0B132B]">{b.student_name}</td>
                    <td className="px-5 py-3.5 text-[#6B7280]">{b.age ?? "—"}</td>
                    <td className="px-5 py-3.5 text-[#6B7280]">{b.phone}</td>
                    <td className="px-5 py-3.5 text-[#6B7280]">
                      {b.preferred_day ?? "—"}{b.preferred_time ? ` · ${b.preferred_time}` : ""}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-5 py-3.5 text-[#9CA3AF]">
                      {new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-5 py-3.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-[#D1D5DB] transition-transform ${expanded === b.id ? "rotate-180" : ""}`}>
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </td>
                  </tr>
                  {expanded === b.id && (
                    <tr key={`${b.id}-detail`} className="bg-[#F9FAFB]/40">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {b.school && (
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">School</p>
                              <p className="mt-0.5 text-[13px] text-[#0B132B]">{b.school}</p>
                            </div>
                          )}
                          {b.another_phone && (
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Alt Phone</p>
                              <p className="mt-0.5 text-[13px] text-[#0B132B]">{b.another_phone}</p>
                            </div>
                          )}
                          {b.notes && (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Notes</p>
                              <p className="mt-0.5 text-[13px] text-[#0B132B]">{b.notes}</p>
                            </div>
                          )}
                          <div className="sm:col-span-2 lg:col-span-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Update Status</p>
                            <div className="flex flex-wrap gap-2">
                              {STATUSES.map((s) => (
                                <button
                                  key={s}
                                  disabled={updating === b.id || b.status === s}
                                  onClick={(e) => { e.stopPropagation(); updateStatus(b.id, s); }}
                                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                                    b.status === s
                                      ? "bg-[#0B132B] text-white"
                                      : "bg-white text-[#6B7280] ring-1 ring-gray-200 hover:ring-[#19C6F4] hover:text-[#19C6F4]"
                                  } disabled:opacity-50`}
                                >
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-[#9CA3AF]">No bookings yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
