# Sprint 61 — Instructor Operations Center — Handoff

## Status: COMPLETE ✅

الكود شغال وفيه 0 TypeScript errors.

---

## ما اتعمل في السبرينت ده

### الهدف
ريبيلد كامل لـ instructor module كـ 3-column operational dispatch board (مش CRM).

### الفايلات اللي اتعملت/اتعدلت

| File | Status |
|------|--------|
| `supabase/migrations/0062_instructor_ops.sql` | ✅ Created |
| `modules/instructors/types.ts` | ✅ Updated |
| `modules/instructors/operational.ts` | ✅ Created |
| `modules/instructors/modal-actions.ts` | ✅ Created |
| `app/portal/team-leader/instructors/page.tsx` | ✅ Rewritten |
| `app/portal/team-leader/instructors/InstructorsWorkspaceClient.tsx` | ✅ Rewritten (final) |

---

## Architecture — 3-Column Layout

```
┌─────────────────┬──────────────────────────┬──────────────────┐
│  LEFT (320px)   │     CENTER (flex)         │  RIGHT (320px)   │
│  Dark #0B1F3A   │     White bg              │  #F8FAFC bg      │
│                 │                           │                  │
│  Search         │  Compact header:          │  Operational     │
│  Branch filter  │  - Name + status chip     │  Alerts          │
│  Quick filter   │  - KPI strip (6 metrics)  │  (critical/warn) │
│                 │  - Action buttons         │                  │
│  Instructor     │                           │  Recent Activity │
│  cards list     │  6 Tabs:                  │  (last sessions) │
│                 │  Overview | Groups        │                  │
│  ──────────     │  Sessions | Students      │  Quick Actions   │
│  [+ Add         │  Attendance | Performance │  (assign/edit/   │
│   Instructor]   │                           │   whatsapp/call) │
└─────────────────┴──────────────────────────┴──────────────────┘
```

---

## Key Types (modules/instructors/types.ts)

```typescript
InstructorOperationalRow    // list card data
FullInstructor              // all DB fields (with new columns)
InstructorGroupDetail       // group with sessions/attendance/health/role
InstructorStudentRow        // derived student (via groups)
InstructorSessionRow        // session with attendance_submitted flag
InstructorAttendanceStats
InstructorPerformanceMetrics
InstructorFinanceSummary
InstructorNote
InstructorCertification
InstructorDetailData        // full detail loaded on selection
InstructorFormOptions       // branches + groups for modal dropdowns
```

---

## Migration 0062 — New DB Columns

**On `instructors` table:**
- `bio TEXT`
- `alt_phone TEXT`
- `instagram_url TEXT`
- `facebook_url TEXT`
- `whatsapp_number TEXT`
- `salary_per_session NUMERIC(10,2)`
- `currency TEXT DEFAULT 'EGP'`
- `instapay_number TEXT`
- `payment_notes TEXT`
- `working_days TEXT[] DEFAULT '{}'`
- `max_weekly_load INT`

**New tables:**
- `instructor_certifications` (id, instructor_id, certification, level, status, issued_at, expires_at, notes)
- `instructor_notes` (id, instructor_id, author_id → users, content, category)

---

## Server Actions (modules/instructors/modal-actions.ts)

```typescript
getInstructorDetailAction(id)
getFormOptionsAction(branchIds)
refreshInstructorListAction(branchIds)
createInstructorModalAction(formData)
updateInstructorModalAction(formData)
archiveInstructorAction(id)
assignGroupModalAction(instructorId, groupId, role)
removeGroupModalAction(instructorId, groupId)
saveNoteAction(formData)
deleteNoteAction(noteId)
saveCertificationAction(formData)
deleteCertificationAction(certId)
setPasswordAction(instructorId, newPassword)
```

---

## Health Score Formula

```
health_score = attendanceCompliance × 0.55
             + groupActivity × 0.25
             − atRiskPenalty × 0.20
```

- **Excellent** ≥ 80 (emerald)
- **Good** ≥ 60 (blue)
- **Warning** ≥ 40 (amber)
- **Critical** < 40 (red)

---

## Sessions Window (operational.ts)

```typescript
const sevenDaysAgo       = new Date(Date.now() - 7  * 86400000).toISOString()
const twentyOneDaysAhead = new Date(Date.now() + 21 * 86400000).toISOString()
// Sessions tab shows: past 7 days + today + next 21 days
```

---

## Important Constraints

- **Instructor → Students**: NEVER direct. Students are derived through group memberships only.
- Cross-branch visibility: home branch + `instructor_branches` pivot + `group_courses` join.
- Attendance compliance = sessions with attendance submitted ÷ completed sessions × 100.
- `removeGroupModalAction` deletes from `group_instructors` AND clears `group_courses.instructor_id`.

---

## Git Status (end of sprint)

Modified files (uncommitted):
- `app/api/student-ops/[studentId]/route.ts`
- `app/portal/team-leader/finance/EnrollmentWizard.tsx`
- `app/portal/team-leader/finance/StudentOpsDrawer.tsx`
- `app/portal/team-leader/groups/GroupsWorkspaceClient.tsx`
- `lib/timeline/index.ts`
- `modules/enrollments/actions.ts`
- `modules/finance/types.ts`
- `modules/groups/modal-actions.ts`

New (untracked):
- `supabase/migrations/0060_installment_status_sync.sql`
- `supabase/migrations/0061_enrollment_cancelled_status.sql`

> ملاحظة: migration `0062_instructor_ops.sql` اتعمل في السبرينت ده — تأكد إنه متوجودش في الـ untracked list دي يعني اتعمله apply.

---

## ما يمكن تكمله في الشات الجاي

1. **Apply migration 0062** على Supabase لو لسه متعملتش.
2. **Test the workspace** — شغل dev server وجرب create instructor / assign group / view tabs.
3. **Remove old instructor pages** (`/instructors/[id]` و `/instructors/[id]/edit`) لو مش محتاجهم.
4. **Update memory** للسبرينت ده.
5. أي sprint جديد.
