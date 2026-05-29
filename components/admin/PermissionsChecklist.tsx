'use client'

import { useState } from 'react'
import { PERMISSION_GROUPS } from '@/modules/rbac/permissions'
import type { ConfigurablePermission } from '@/modules/rbac/permissions'

interface Props {
  defaultPermissions: string[]
}

export default function PermissionsChecklist({ defaultPermissions }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(defaultPermissions))

  const toggle = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const selectAll  = () => setChecked(new Set(PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.name))))
  const clearAll   = () => setChecked(new Set())

  return (
    <div className="border-t border-[#E2E8F0] pt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Permissions</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-[#FF8A1F] hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-[#64748B] hover:underline"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-xs font-medium text-[#0B1F3A]">{group.label}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {group.permissions.map((perm) => (
                <label
                  key={perm.name}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    name="permission"
                    value={perm.name}
                    checked={checked.has(perm.name)}
                    onChange={() => toggle(perm.name)}
                    className="h-4 w-4 rounded border-[#CBD5E1] accent-[#FF8A1F]"
                  />
                  <span className="text-sm text-[#0B1F3A]">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
