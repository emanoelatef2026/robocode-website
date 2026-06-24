// Student Health Score — runtime calculation, no schema changes
// Formula: 40% Attendance + 30% Assignments + 20% Portfolio + 10% Feedback (default 100 if unavailable)

export interface HealthScore {
  score:  number
  level:  'excellent' | 'good' | 'attention' | 'at_risk'
  label:  string
  cls:    string   // Tailwind color classes
}

export function computeHealthScore(
  attendanceScore:  number,
  assignmentScore:  number,
  portfolioScore:   number,
  feedbackScore:    number = 100,
): HealthScore {
  const score = Math.round(
    attendanceScore  * 0.40 +
    assignmentScore  * 0.30 +
    portfolioScore   * 0.20 +
    feedbackScore    * 0.10
  )

  if (score >= 90) return { score, level: 'excellent', label: 'Excellent', cls: 'bg-[#E7F8EE]  text-[#15803D]'  }
  if (score >= 75) return { score, level: 'good',      label: 'Good',      cls: 'bg-[#EFF6FF]   text-[#1D4ED8]'   }
  if (score >= 60) return { score, level: 'attention', label: 'Attention', cls: 'bg-yellow-100 text-yellow-700' }
  return               { score, level: 'at_risk',   label: 'At Risk',   cls: 'bg-[#FEE2E2]    text-[#DC2626]'    }
}
