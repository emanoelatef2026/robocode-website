import type { FinanceAdjType } from "@/modules/staff-finance/types"

export const TABS = [
  { id: "instructors", label: "Instructors" },
  { id: "staff",       label: "Staff"       },
  { id: "summary",     label: "Summary"     },
] as const

export type TabId = typeof TABS[number]["id"]

export const ADJ_TYPES: FinanceAdjType[] = [
  "bonus", "penalty", "advance", "purchase", "reimbursement", "other",
]

export const MONTHS = [
  { value: 1,  label: "January"   }, { value: 2,  label: "February"  },
  { value: 3,  label: "March"     }, { value: 4,  label: "April"     },
  { value: 5,  label: "May"       }, { value: 6,  label: "June"      },
  { value: 7,  label: "July"      }, { value: 8,  label: "August"    },
  { value: 9,  label: "September" }, { value: 10, label: "October"   },
  { value: 11, label: "November"  }, { value: 12, label: "December"  },
]

export const ROLE_OPTIONS = [
  "team_leader", "coordinator", "branch_manager",
  "admin", "sales", "marketing", "operations", "finance", "other",
]
