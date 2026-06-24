'use client'

import type { ReactNode } from 'react'

interface Column<T> {
  key:       string
  header:    string
  cell:      (row: T) => ReactNode
  align?:    'left' | 'right' | 'center'
  className?: string
}

interface OperationalTableProps<T> {
  columns:    Column<T>[]
  rows:       T[]
  keyFn:      (row: T) => string
  onRowClick?: (row: T) => void
  empty?:     ReactNode
  className?: string
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left:   'text-left',
  right:  'text-right',
  center: 'text-center',
}

export function OperationalTable<T>({
  columns,
  rows,
  keyFn,
  onRowClick,
  empty,
  className = '',
}: OperationalTableProps<T>) {
  if (!rows.length) {
    return empty ? <>{empty}</> : null
  }
  return (
    <div className={`overflow-x-auto rounded-xl border border-[#E2E8F0] ${className}`}>
      <table className="min-w-full text-xs">
        <thead className="ds-table-head">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`border-b border-[#E2E8F0] px-4 py-2.5 font-semibold text-[#64748B] ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={keyFn(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-[#F1F5F9] last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-[#F8FAFC]' : ''}`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-2.5 text-[#374151] ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
