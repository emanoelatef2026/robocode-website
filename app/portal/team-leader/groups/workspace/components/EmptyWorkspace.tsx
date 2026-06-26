export function EmptyWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[#94A3B8]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-4 h-14 w-14 opacity-25">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p className="text-[15px] font-semibold text-[#374151] mb-1">Select a group</p>
      <p className="text-[13px] text-[#94A3B8]">Choose a group from the left panel to open its workspace.</p>
    </div>
  )
}
