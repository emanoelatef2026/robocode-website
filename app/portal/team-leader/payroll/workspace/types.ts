import type { FinanceAdjType } from "@/modules/staff-finance/types"

export { MONTHS } from "@/modules/finance/shared/date"

export const TABS = [
  { id: "instructors", label: "Instructors" },
  { id: "staff",       label: "Employees"    },
  { id: "summary",     label: "Summary"     },
] as const

export type TabId = typeof TABS[number]["id"]

export const ADJ_TYPES: FinanceAdjType[] = [
  "bonus", "penalty", "advance", "purchase", "reimbursement", "other",
]

export const ROLE_OPTIONS = [
  "team_leader", "coordinator", "branch_manager",
  "admin", "sales", "marketing", "operations", "finance", "other",
]
