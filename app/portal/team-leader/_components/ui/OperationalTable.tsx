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
    <div className={`overflow-x-auto rounded-xl border border-[#D7E0EA] bg-white ${className}`}>
      <table className="min-w-full text-[13px]">
        <thead className="ds-table-head">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`border-b border-[#D7E0EA] px-4 py-3 ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
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
              className={`border-b border-[#EDF1F5] last:border-0 ${onRowClick ? 'cursor-pointer transition-colors hover:bg-[#F8FAFC]' : ''}`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-[#334155] ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
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
