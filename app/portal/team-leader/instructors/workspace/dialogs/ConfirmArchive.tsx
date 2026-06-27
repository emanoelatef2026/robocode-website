export function ConfirmArchive({ name, onConfirm, onCancel, isPending }: {
  name:      string
  onConfirm: () => void
  onCancel:  () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-[15px] font-bold text-[#0B1F3A]">Archive Instructor</h2>
        <p className="mt-2 text-[13px] text-[#64748B]">
          Archive <strong>{name}</strong>? They will be marked inactive and lose portal access.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 rounded-lg bg-[#EF4444] py-2 text-[13px] font-semibold text-white hover:bg-[#DC2626] disabled:opacity-50 transition">
            {isPending ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  )
}
