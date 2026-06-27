import { fmtEGP } from "@/modules/staff-finance/types"
import type { InstructorFinanceRow, StaffFinanceRow, FinanceAdjustment } from "@/modules/staff-finance/types"
import { INSTRUCTOR_PAYMENT_METHOD_LABELS, STAFF_PAYMENT_METHOD_LABELS, STAFF_ROLE_LABELS } from "@/modules/staff-finance/types"
import { Avatar } from "./Avatar"
import { AdjBadge } from "./AdjBadge"
import { DrawerRow } from "./DrawerRow"

interface Props {
  drawer: { kind: "instructor"; row: InstructorFinanceRow } | { kind: "staff"; row: StaffFinanceRow }
  onClose: () => void
  onAdjust: (kind: "instructor" | "staff", id: string, bId: string, name: string) => void
  onRemoveAdj: (id: string) => void
  onPayInfo: (row: InstructorFinanceRow) => void
  onEditStaff: (row: StaffFinanceRow) => void
}

export function DrawerContent({
  drawer,
  onClose,
  onAdjust,
  onRemoveAdj,
  onPayInfo,
  onEditStaff,
}: Props) {
  const isInstructor = drawer.kind === "instructor"
  const row          = drawer.row

  const adjList: FinanceAdjustment[] = isInstructor
    ? (row as InstructorFinanceRow).adjustments
    : (row as StaffFinanceRow).adjustments

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <Avatar name={row.display_name} size="md" />
          <div>
            <p className="font-bold text-[#0B1F3A] text-[15px]">{row.display_name}</p>
            <p className="text-[11px] text-[#94A3B8]">
              {isInstructor
                ? `${(row as InstructorFinanceRow).branch_name} · Instructor`
                : `${(row as StaffFinanceRow).branch_name} · ${STAFF_ROLE_LABELS[(row as StaffFinanceRow).role] ?? (row as StaffFinanceRow).role}`
              }
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Earnings breakdown */}
        <div>
          <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5">Earnings Breakdown</p>
          <div className="space-y-1.5">
            {isInstructor && (
              <>
                <DrawerRow label="Sessions" value={`${(row as InstructorFinanceRow).sessions_count} sessions × ${fmtEGP((row as InstructorFinanceRow).salary_per_session)}`} />
                <DrawerRow label="Session Earnings" value={fmtEGP((row as InstructorFinanceRow).session_earnings)} bold />
              </>
            )}
            {!isInstructor && (
              <DrawerRow label="Base Salary" value={fmtEGP((row as StaffFinanceRow).basic_salary)} bold />
            )}
            {adjList.length > 0 && (
              <DrawerRow
                label="Adjustments"
                value={`${row.adj_net >= 0 ? "+" : ""}${fmtEGP(row.adj_net)}`}
                cls={row.adj_net >= 0 ? "text-[#15803D] font-semibold" : "text-[#EF4444] font-semibold"}
              />
            )}
            <div className="border-t border-[#E2E8F0] pt-2 mt-1">
              <DrawerRow label="Net Amount" value={fmtEGP(row.net_amount)} bold hi />
            </div>
          </div>
        </div>

        {/* Payment info */}
        <div>
          <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5">Payment Info</p>
          <div className="space-y-1.5">
            {isInstructor ? (
              <>
                <DrawerRow
                  label="Method"
                  value={
                    (row as InstructorFinanceRow).payment_method
                      ? INSTRUCTOR_PAYMENT_METHOD_LABELS[(row as InstructorFinanceRow).payment_method!] ?? "—"
                      : "Not set"
                  }
                />
                {(row as InstructorFinanceRow).instapay_number && (
                  <DrawerRow label="Instapay" value={(row as InstructorFinanceRow).instapay_number!} />
                )}
                {(row as InstructorFinanceRow).payment_notes && (
                  <DrawerRow label="Notes" value={(row as InstructorFinanceRow).payment_notes!} />
                )}
              </>
            ) : (
              <>
                <DrawerRow label="Method" value={STAFF_PAYMENT_METHOD_LABELS[(row as StaffFinanceRow).payment_method] ?? (row as StaffFinanceRow).payment_method} />
                {(row as StaffFinanceRow).payment_reference && (
                  <DrawerRow label="Reference" value={(row as StaffFinanceRow).payment_reference!} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Adjustments list */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
              Adjustments ({adjList.length})
            </p>
            <button
              onClick={() => {
                const id = isInstructor
                  ? (row as InstructorFinanceRow).instructor_id
                  : (row as StaffFinanceRow).profile_id
                onAdjust(drawer.kind, id, row.branch_id, row.display_name)
              }}
              className="text-[11px] font-semibold text-[#FF8A1F] hover:text-[#e07018] transition"
            >
              + Add
            </button>
          </div>
          {adjList.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8] italic">No adjustments in this period.</p>
          ) : (
            <div className="space-y-1.5">
              {adjList.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AdjBadge type={a.type} amount={a.amount} />
                    {a.notes && <p className="text-[11px] text-[#64748B]">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-[#94A3B8]">{a.adjustment_date}</p>
                    <button
                      onClick={() => onRemoveAdj(a.id)}
                      className="text-[#CBD5E1] hover:text-[#F87171] transition"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-[#E2E8F0] px-5 py-3 flex gap-2">
        {isInstructor && (
          <button
            onClick={() => onPayInfo(row as InstructorFinanceRow)}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[12px] font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
          >
            Edit Payment Info
          </button>
        )}
        {!isInstructor && (
          <button
            onClick={() => onEditStaff(row as StaffFinanceRow)}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[12px] font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
          >
            Edit Profile
          </button>
        )}
      </div>
    </div>
  )
}
