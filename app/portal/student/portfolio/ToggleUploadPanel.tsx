'use client'

import { useState } from 'react'
import UploadProjectForm from './UploadProjectForm'

export default function ToggleUploadPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="ds-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[#F8FAFC]"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF8A1F] text-sm font-bold text-white">+</span>
          <span className="text-sm font-semibold text-[#0B1F3A]">Upload New Project</span>
        </div>
        <span className="text-[#94A3B8]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-[#E2E8F0] px-5 py-5">
          <UploadProjectForm mode="create" onCancel={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
