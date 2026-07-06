'use client'

import { useRouter } from 'next/navigation'
import type {
  FinancialExpense, RecurringExpense,
  GroupPnL, BranchPnL, AcademyPnL,
} from '@/modules/finance/types'
import { exportBranchesExcel, type Branch, type Group } from './components/shared'
import { LiveFilterBar } from './components/LiveFilterBar'
import { GroupsTab } from './components/GroupsTab'
import { BranchesTab } from './components/BranchesTab'
import { AcademyTab } from './components/AcademyTab'
import { RecurringTab } from './components/RecurringTab'

interface Props {
  groupRows:       GroupPnL[]
  branchRows:      BranchPnL[]
  academyPnL:      AcademyPnL
  expenses:        FinancialExpense[]
  recurring:       RecurringExpense[]
  branches:        Branch[]
  groups:          Group[]
  activeTab:       string
  currentBranchId: string
  currentDateFrom: string
  currentDateTo:   string
  includeArchived: boolean
  isSuperAdmin:    boolean
}

export default function FinancialManagementClient({
  groupRows, branchRows, academyPnL, expenses, recurring,
  branches, groups,
  activeTab, currentBranchId, currentDateFrom, currentDateTo, includeArchived,
  isSuperAdmin,
}: Props) {
  const router = useRouter()

  function refresh() {
    router.refresh()
  }

  const tabs = [
    { key: 'groups',    label: 'Groups'    },
    { key: 'branches',  label: 'Branches'  },
    { key: 'academy',   label: 'Academy'   },
    { key: 'recurring', label: 'Fixed Expenses' },
  ]

  function switchTab(key: string) {
    const params = new URLSearchParams()
    params.set('tab', key)
    if (currentBranchId) params.set('branch_id',  currentBranchId)
    if (currentDateFrom) params.set('date_from',   currentDateFrom)
    if (currentDateTo)   params.set('date_to',     currentDateTo)
    if (includeArchived) params.set('archived',    '1')
    router.push(`/admin/finance-center?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex gap-1 rounded-lg bg-[#F1F5F9] p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-xs font-semibold transition ${
              activeTab === t.key
                ? 'bg-white text-[#0B1F3A] shadow-sm'
                : 'text-[#64748B] hover:text-[#0B1F3A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date + branch filters */}
      <LiveFilterBar
        branches={branches}
        currentBranchId={currentBranchId}
        currentDateFrom={currentDateFrom}
        currentDateTo={currentDateTo}
        includeArchived={includeArchived}
        activeTab={activeTab}
        rightAction={activeTab === 'branches' ? (
          <button
            onClick={() => exportBranchesExcel(branchRows)}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A] transition"
          >
            ↓ Excel
          </button>
        ) : undefined}
      />

      {/* Tab content */}
      {activeTab === 'groups' && (
        <GroupsTab
          rows={groupRows}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'branches' && (
        <BranchesTab
          rows={branchRows}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'academy' && (
        <AcademyTab
          pnl={academyPnL}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'recurring' && (
        <RecurringTab
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
