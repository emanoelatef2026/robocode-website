import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Sprint 1 — the leaderboard page used to re-implement the "student's
// primary group" lookup inline, sorted by joined_at DESCENDING, while
// resolvePrimaryActiveGroupId (used by every other student-portal page)
// sorts ASCENDING — a live, confirmed inconsistency where a student in 2+
// active groups could see a different "primary" course on the leaderboard
// than on the dashboard/attendance/certificates pages in the same session.
// The fix: the leaderboard now calls the shared resolver instead of
// re-implementing the query, which structurally prevents this class of bug
// from recurring (there is no second sort order left to drift).
describe('student leaderboard — primary group resolution', () => {
  it('delegates to resolvePrimaryActiveGroupId instead of re-implementing the sort', () => {
    const file = path.resolve(process.cwd(), 'app/portal/student/leaderboard/page.tsx')
    const src  = fs.readFileSync(file, 'utf-8')

    expect(src).toContain("from '@/modules/academic/enrollment-integrity'")
    expect(src).toContain('resolvePrimaryActiveGroupId(db, studentId)')
    // The old inline re-implementation (descending sort on group_students) must be gone.
    expect(src).not.toContain("order('joined_at', { ascending: false })")
  })
})
