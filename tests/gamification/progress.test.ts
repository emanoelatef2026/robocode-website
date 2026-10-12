import { describe, expect, it } from 'vitest'
import { activeLearningStreak, evaluationHighlights, xpMilestone } from '@/modules/gamification/progress'
import type { StudentEvaluation } from '@/modules/student-evaluations/types'

describe('learning progress', () => {
  it('shows expired streaks as zero while preserving yesterday and today', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(activeLearningStreak(3, '2026-10-12', now)).toBe(3)
    expect(activeLearningStreak(3, '2026-10-11', now)).toBe(3)
    expect(activeLearningStreak(3, '2026-10-10', now)).toBe(0)
  })

  it('reports XP remaining in the current level', () => {
    expect(xpMilestone(650)).toMatchObject({ remaining: 350, percent: 30 })
    expect(xpMilestone(29000)).toMatchObject({ remaining: 0, percent: 100 })
  })

  it('uses only visible evaluations passed by the caller for skills and goals', () => {
    const rows = [
      { criterion: 'PROGRAMMING', rating: 4, next_goal: 'Build a loop', feedback: 'Great effort' },
      { criterion: 'PROGRAMMING', rating: 5, next_goal: null, feedback: null },
    ] as StudentEvaluation[]
    expect(evaluationHighlights(rows)).toMatchObject({
      nextGoal: 'Build a loop',
      latestPraise: 'Great effort',
      skills: [{ criterion: 'PROGRAMMING', average: 4.5, count: 2 }],
    })
  })
})
