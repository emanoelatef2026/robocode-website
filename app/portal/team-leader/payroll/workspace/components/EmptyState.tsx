export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white px-6 py-12 text-center">
      <p className="text-[13px] text-[#94A3B8]">{message}</p>
    </div>
  )
}
