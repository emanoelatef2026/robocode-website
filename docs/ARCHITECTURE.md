# Robocode LMS — Full System Architecture Blueprint

**Version:** 1.1  
**Date:** 2026-05-25  
**Status:** Phase 0 — Infrastructure implementation  
**Stack:** Next.js 16, Supabase (PostgreSQL), TypeScript, Tailwind CSS v4

### Changelog v1.1
- **Financial system**: Full architecture added — subscriptions, installments, discounts, coupons, instructor payouts, refunds, branch pricing (see Section 21)
- **Video infrastructure**: Videos NOT stored in Supabase Storage. External providers only (Google Drive, YouTube, Vimeo). New `external_videos` table stores metadata + links (see Section 17)
- **Session recordings**: `session_recordings` table links to external provider URLs with student/parent access flags (see Section 11)
- **Search system**: Full-text search via pg_trgm + tsvector across all entity types. `search_index` view + `search_entities()` DB function (see Section 4 + migration 0014)
- **Localization**: DB schema and system naming remain English-only. Frontend uses existing i18n system
- **Project structure**: Complete folder refactor plan finalized (see docs/PROJECT-STRUCTURE.md)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Architecture](#3-database-architecture)
4. [Entity Relationship Design (ERD)](#4-entity-relationship-design-erd)
5. [Authentication Architecture](#5-authentication-architecture)
6. [RBAC Permissions System](#6-rbac-permissions-system)
7. [Ownership Model](#7-ownership-model)
8. [Multi-Branch Architecture](#8-multi-branch-architecture)
9. [Group & Cohort Architecture](#9-group--cohort-architecture)
10. [Course System Architecture](#10-course-system-architecture)
11. [Attendance Architecture](#11-attendance-architecture)
12. [Assignments & Submissions](#12-assignments--submissions)
13. [Student Progress System](#13-student-progress-system)
14. [Parent Portal Architecture](#14-parent-portal-architecture)
15. [Notification System](#15-notification-system)
16. [Analytics Architecture](#16-analytics-architecture)
17. [Media & Storage Architecture](#17-media--storage-architecture)
18. [Audit Logs](#18-audit-logs)
19. [Dashboard Structure per Role](#19-dashboard-structure-per-role)
20. [AI Integration Points](#20-ai-integration-points)
21. [Complete Table Definitions](#21-complete-table-definitions)
22. [Permission Matrix](#22-permission-matrix)
23. [Scalability Concerns](#23-scalability-concerns)
24. [Security Concerns](#24-security-concerns)
25. [Recommended Build Phases](#25-recommended-build-phases)
26. [Technical Recommendations](#26-technical-recommendations)

---

## 1. System Overview

Robocode is transitioning from a marketing website into a full **Learning Management System (LMS) + Educational Operating System (EOS)**. The platform must serve five distinct user roles across multiple branches, supporting both online and offline operations.

### Core Principles

- **Branch-first isolation** — All data is scoped to a branch unless explicitly shared
- **Role-based access** — Granular permissions, never `if role === 'admin'`
- **Scalable from day one** — Schema designed for growth without breaking changes
- **AI-ready** — Hooks and tables planned for future AI agents
- **Audit everything** — All mutations are logged for compliance

### System Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROBOCODE PLATFORM                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Student  │  │  Parent  │  │Instructor│  │  Team    │       │
│  │  Portal  │  │  Portal  │  │  Portal  │  │  Leader  │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │              │
│  ┌────▼──────────────▼──────────────▼──────────────▼────────┐   │
│  │                   Next.js 16 App Router                   │   │
│  └────────────────────────┬──────────────────────────────────┘   │
│                           │                                       │
│  ┌────────────────────────▼──────────────────────────────────┐   │
│  │                    Supabase Backend                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │   Auth   │  │ Postgres │  │  Storage │  │ Edge Fn  │  │   │
│  │  │  + JWT   │  │  + RLS   │  │  Buckets │  │(webhooks)│  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 16 (App Router) | Already in use; RSC for performance |
| Database | Supabase / PostgreSQL | Already in use; RLS for security |
| Auth | Supabase Auth | JWT, MFA, magic link, OAuth |
| Storage | Supabase Storage | Buckets per content type |
| Edge Functions | Supabase Edge Functions | Webhooks, cron jobs, notifications |
| Email | Resend | Already in use |
| Type Safety | TypeScript + Zod | Runtime validation |
| Realtime | Supabase Realtime | Notifications, live attendance |
| Search (future) | pgvector | AI semantic search |
| Queue (future) | pg_background or external | Background jobs |

---

## 3. Database Architecture

### Design Decisions

1. **Single schema** — All tables in `public` schema; use RLS for isolation
2. **Branch scoping** — `branch_id` on all tenant-specific entities
3. **Soft deletes** — `deleted_at` timestamp instead of hard deletes
4. **JSONB for flexibility** — `metadata` and `settings` columns use JSONB
5. **UUID primary keys** — All tables use `gen_random_uuid()`
6. **Timestamps** — `created_at`, `updated_at` on every table
7. **Immutable audit** — `audit_logs` append-only, never updated

### Schema Groups

```
GROUP A — Identity & Access
  users, profiles, roles, permissions, role_permissions, user_roles

GROUP B — Organization Structure
  organizations, branches, semesters, settings

GROUP C — People
  students, instructors, parents, parent_students, staff

GROUP D — Academic Structure
  groups, group_students, group_instructors, group_courses

GROUP E — Curriculum
  courses, course_modules, lessons, lesson_resources, lesson_completions

GROUP F — Scheduling
  schedules, schedule_exceptions, makeup_sessions

GROUP G — Attendance
  attendance_records

GROUP H — Assessments
  assignments, submissions, quizzes, quiz_questions, quiz_options, quiz_attempts

GROUP I — Progress
  student_progress, student_grade_summaries

GROUP J — Communication
  notifications, notification_recipients, announcements, announcement_reads, feedback_notes, messages

GROUP K — Financials
  invoices, payments, payment_items

GROUP L — Analytics
  analytics_events, analytics_snapshots

GROUP M — Media
  media_assets

GROUP N — Audit
  audit_logs

GROUP O — AI (future)
  ai_interactions, ai_recommendations, ai_reports, vector_embeddings
```

---

## 4. Entity Relationship Design (ERD)

### Core Relationships

```
organizations (1)
  └── branches (many)
        ├── semesters (many)
        ├── groups (many)
        │     ├── group_students (many) ──► students
        │     ├── group_instructors (many) ──► instructors
        │     └── group_courses (many) ──► courses
        │           └── schedules (many)
        │                 └── attendance_records (many) ──► students
        ├── students (many) ──► users (1)
        ├── instructors (many) ──► users (1)
        └── courses (many)
              └── course_modules (many)
                    └── lessons (many)
                          ├── lesson_resources (many)
                          ├── lesson_completions (many) ──► students
                          └── assignments (many)
                                └── submissions (many) ──► students

users (1) ──► profiles (1)
users (many) ──► user_roles (many) ──► roles (many) ──► role_permissions (many) ──► permissions

students (many) ◄──► parents (many)  [via parent_students]

users (1) ──► notifications (many) [via notification_recipients]
```

### Key Cardinalities

| Entity | Relationship | Entity |
|---|---|---|
| Organization | 1:N | Branches |
| Branch | 1:N | Semesters |
| Branch | 1:N | Groups |
| Branch | 1:N | Students |
| Branch | 1:N | Instructors |
| Branch | 1:N | Courses |
| Group | M:N | Students (via group_students) |
| Group | M:N | Instructors (via group_instructors) |
| Group | M:N | Courses (via group_courses) |
| Course | 1:N | Modules |
| Module | 1:N | Lessons |
| Lesson | 1:N | Assignments |
| Assignment | 1:N | Submissions |
| Student | M:N | Parents (via parent_students) |
| Schedule | 1:N | Attendance Records |
| User | M:N | Roles (via user_roles, scoped to branch) |
| Role | M:N | Permissions (via role_permissions) |

---

## 5. Authentication Architecture

### Flow

```
User → Supabase Auth → JWT issued
         │
         ├── Custom claims injected via Auth hook:
         │     { role: 'instructor', branch_ids: ['uuid1'], permissions: [...] }
         │
         └── JWT stored in httpOnly cookie (Next.js SSR)
                │
                ├── Server Components: createServerClient() reads cookie
                └── Client Components: createBrowserClient() reads session
```

### JWT Custom Claims Structure

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "global_role": "instructor",
    "branch_ids": ["branch-uuid-1", "branch-uuid-2"],
    "permissions": ["manage_attendance", "grade_assignments", "view_analytics"]
  }
}
```

### Auth Methods Supported

| Method | Use Case |
|---|---|
| Magic Link | Default for students/parents |
| Email + Password | Staff, instructors, admins |
| Google OAuth | Optional for students |
| MFA (TOTP) | Required for admins and team leaders |

### Session Management

- JWT expiry: 1 hour
- Refresh token: 7 days
- Server-side session validation on every protected route
- Supabase Auth hook refreshes custom claims on each token refresh

### RLS Policy Strategy

```sql
-- Example: Instructors can only see students in their branch
CREATE POLICY "instructors_view_own_branch_students"
ON students FOR SELECT
USING (
  branch_id IN (
    SELECT branch_id FROM user_roles
    WHERE user_id = auth.uid()
    AND role_id = (SELECT id FROM roles WHERE name = 'instructor')
  )
);
```

All data access enforced at DB level via RLS — API routes are secondary guards.

---

## 6. RBAC Permissions System

### Design: Resource × Action Matrix

Permissions follow the pattern `{action}_{resource}`:

```
Actions:  create | read | update | delete | manage (all)
Resources: system | branches | users | students | instructors | parents |
           courses | modules | lessons | groups | schedules | attendance |
           assignments | grades | quizzes | financials | notifications |
           announcements | feedback | analytics | media | audit_logs |
           permissions | ai
```

### Full Permission Registry

```
SYSTEM
  manage_system            — Full system control (Super Admin only)
  manage_permissions       — Edit role → permission assignments

ORGANIZATION
  manage_branches          — Create/edit/delete branches
  read_branches            — View branch info
  manage_settings          — Change org/branch settings

USERS
  manage_users             — Create/deactivate any user
  manage_students          — Full CRUD on student records
  manage_instructors       — Full CRUD on instructor records
  manage_parents           — Full CRUD on parent records

ACADEMIC
  manage_groups            — Create/edit groups and cohorts
  manage_courses           — Create/edit/publish courses
  manage_modules           — Edit course modules
  manage_lessons           — Edit lessons and resources
  manage_schedule          — Create/edit class schedules
  manage_attendance        — Record and edit attendance
  read_attendance          — View attendance records
  manage_assignments       — Create/edit assignments
  grade_assignments        — Grade submissions
  read_grades              — View student grades
  manage_quizzes           — Create/edit quizzes
  manage_curriculum        — Full curriculum control

FINANCIALS
  manage_financials        — Create invoices, record payments
  read_financials          — View financial reports

ANALYTICS
  read_analytics           — View analytics dashboards
  export_analytics         — Export reports

COMMUNICATION
  send_announcements       — Create branch-wide announcements
  send_notifications       — Trigger manual notifications
  manage_feedback          — Write/edit instructor feedback notes

CONTENT
  manage_media             — Upload/delete media assets
  read_media               — View media assets

AUDIT
  read_audit_logs          — View audit history

AI (future)
  manage_ai_agents         — Configure AI agents
  read_ai_reports          — View AI-generated reports
```

### Role → Permission Assignment

| Permission | Super Admin | Team Leader | Instructor | Student | Parent |
|---|:---:|:---:|:---:|:---:|:---:|
| manage_system | ✓ | — | — | — | — |
| manage_permissions | ✓ | — | — | — | — |
| manage_branches | ✓ | ✓ (own) | — | — | — |
| manage_settings | ✓ | ✓ (own) | — | — | — |
| manage_users | ✓ | — | — | — | — |
| manage_students | ✓ | ✓ | — | — | — |
| manage_instructors | ✓ | ✓ | — | — | — |
| manage_parents | ✓ | ✓ | — | — | — |
| manage_groups | ✓ | ✓ | — | — | — |
| manage_courses | ✓ | ✓ | ✓ (own) | — | — |
| manage_modules | ✓ | ✓ | ✓ (own) | — | — |
| manage_lessons | ✓ | ✓ | ✓ (own) | — | — |
| manage_schedule | ✓ | ✓ | — | — | — |
| manage_attendance | ✓ | ✓ | ✓ (own classes) | — | — |
| read_attendance | ✓ | ✓ | ✓ (own) | ✓ (own) | ✓ (child) |
| manage_assignments | ✓ | ✓ | ✓ (own) | — | — |
| grade_assignments | ✓ | ✓ | ✓ (own) | — | — |
| read_grades | ✓ | ✓ | ✓ (own students) | ✓ (own) | ✓ (child) |
| manage_quizzes | ✓ | ✓ | ✓ (own) | — | — |
| manage_financials | ✓ | ✓ | — | — | — |
| read_financials | ✓ | ✓ | — | — | ✓ (own) |
| read_analytics | ✓ | ✓ | ✓ (own) | — | — |
| export_analytics | ✓ | ✓ | — | — | — |
| send_announcements | ✓ | ✓ | ✓ (own groups) | — | — |
| send_notifications | ✓ | ✓ | — | — | — |
| manage_feedback | ✓ | ✓ | ✓ (own students) | — | — |
| manage_media | ✓ | ✓ | ✓ (own) | — | — |
| read_media | ✓ | ✓ | ✓ | ✓ | — |
| read_audit_logs | ✓ | ✓ (own branch) | — | — | — |
| manage_ai_agents | ✓ | — | — | — | — |
| read_ai_reports | ✓ | ✓ | ✓ (own) | — | — |

### Permission Check Pattern

```typescript
// Never do this:
if (user.role === 'admin') { ... }

// Always do this:
import { hasPermission } from '@/lib/rbac'

const canGrade = await hasPermission(userId, 'grade_assignments', { branchId })
if (!canGrade) return forbidden()
```

### Permission Resolution Algorithm

```
1. Load user_roles for userId (filter by branchId if scoped)
2. Load all permissions for those roles via role_permissions
3. Merge permission sets (union)
4. Apply resource-level constraints:
   a. Branch scoping: user_role.branch_id must match OR user_role.branch_id IS NULL (global)
   b. Ownership: instructors check group/course ownership
   c. Relationship: parents check parent_students table
5. Return boolean
```

---

## 7. Ownership Model

| Entity | Owner | Delegates To |
|---|---|---|
| Organization | Super Admin | — |
| Branch | Super Admin | Team Leader (assigned) |
| Group/Cohort | Team Leader | Instructor (lead) |
| Course | Team Leader | Instructor (creator) |
| Lesson | Instructor | — |
| Schedule | Team Leader | — |
| Attendance Record | Instructor | Team Leader (edit) |
| Assignment | Instructor | — |
| Submission | Student | Instructor (grade) |
| Student Record | Team Leader | — |
| Feedback Note | Instructor | — |
| Invoice | Team Leader | Super Admin |

**Rule:** A user can only modify entities they own OR have explicit permission to manage from a higher role. Ownership is checked at DB level via RLS.

---

## 8. Multi-Branch Architecture

### Branch Model

```
organizations
  id, name, slug, plan, settings

branches
  id, org_id, name, slug, type, location_data, settings, timezone, is_active
  
  type ENUM: 'online' | 'offline' | 'hybrid'
```

### Branch Isolation Rules

1. All core entities carry `branch_id`
2. `null` branch_id = system-wide (templates, global courses)
3. RLS policies use `branch_id IN (user's assigned branches)`
4. Super Admin has `branch_id = null` in user_roles = access to all
5. Team Leader has specific `branch_id` entries in user_roles

### Cross-Branch Operations

| Operation | Who Can Do It |
|---|---|
| Move student between branches | Super Admin only |
| Share course template across branches | Super Admin, Team Leader (read-only copy) |
| View analytics across all branches | Super Admin only |
| Assign instructor to multiple branches | Super Admin |

### Branch Type Behavior

| Feature | Online | Offline | Hybrid |
|---|---|---|---|
| Meeting URL | Required | — | Optional |
| Room/Location | — | Required | Optional |
| Attendance method | Link-based / QR | Manual / QR | Both |
| Recordings | Stored in media | — | Stored in media |

---

## 9. Group & Cohort Architecture

### Hierarchy

```
Branch
  └── Semester (e.g., "Spring 2026")
        └── Group (e.g., "Robotics Beginners - Group A")
              ├── Students (via group_students)
              ├── Instructors (via group_instructors)
              └── Courses (via group_courses)
                    └── Schedules (class sessions)
```

### Group Types

```
group.type ENUM:
  'class'     — standard scheduled group
  'workshop'  — short-term intensive
  'bootcamp'  — intensive multi-week
  'trial'     — trial/intro session group
  'makeup'    — makeup session group
```

### Student ↔ Group Lifecycle

```
student enrolled → group_students.status = 'active'
student drops    → group_students.status = 'dropped', left_at = now()
student completes → group_students.status = 'graduated'
student paused   → group_students.status = 'paused'
```

### Capacity Management

```
groups.capacity = max students
groups.waitlist_capacity = waitlist slots
group_students.position = seat number (for ordering)
```

---

## 10. Course System Architecture

### Curriculum Hierarchy

```
Course (e.g., "Robotics Fundamentals")
  ├── metadata: level, category, estimated_hours, tags
  └── Module 1 (e.g., "Introduction to Electronics")
        ├── order_index: 1
        └── Lesson 1 (e.g., "What is a Circuit?")
              ├── type: video | text | live | quiz
              ├── content: rich text / embed URL
              ├── Resources (attachments, links)
              └── Assignment (optional, per lesson)

Quiz (standalone or attached to lesson)
  └── Questions
        └── Options (for MCQ)
```

### Course Scope

```
courses.scope ENUM:
  'branch'    — only visible to the branch that created it
  'template'  — visible to all branches (read-only copy on use)
  'global'    — managed by Super Admin, shared across org
```

### Content Delivery

- Text/HTML: stored in DB (`lessons.content` JSONB)
- Videos: stored in Supabase Storage, served via signed URL
- External videos: YouTube/Vimeo embed URLs
- PDFs/files: stored in Supabase Storage `resources` bucket
- Live sessions: Zoom/Meet URLs stored on `schedules.meeting_url`

### Assignment Types

```
assignments.type ENUM:
  'homework'    — take-home work
  'classwork'   — in-session work
  'project'     — multi-day project
  'quiz'        — timed quiz
  'exam'        — formal exam
```

---

## 11. Attendance Architecture

### Attendance Record

```
attendance_records
  id, schedule_id, student_id, status, recorded_by, recorded_at,
  notes, late_minutes, makeup_session_id
  
  status ENUM: 'present' | 'absent' | 'late' | 'excused' | 'makeup'
```

### Recording Methods

| Method | Flow |
|---|---|
| Manual | Instructor marks each student in the app |
| QR Code | Student scans QR at session start; auto-records present |
| Self-report | Student marks themselves (requires instructor confirmation) |
| Bulk import | CSV import for historical data |

### Makeup Session Flow

```
1. Student marked absent
2. Instructor or Team Leader creates makeup_session:
   - references original schedule
   - sets new schedule date/time
3. Student attends makeup
4. attendance_records created with status = 'makeup'
   and makeup_session_id = original session reference
5. Original absence not removed — both records kept for audit
```

### Attendance Calculation

```
attendance_rate = (present + late + makeup) / total_sessions × 100

"Effective attendance" for reporting:
  - late with late_minutes < 15 → counted as present
  - late with late_minutes >= 15 → counted as 0.5
  - makeup → counted as present (after approval)
```

---

## 12. Assignments & Submissions

### Assignment Lifecycle

```
DRAFT → PUBLISHED → OPEN (due_date not passed) → CLOSED (due_date passed)
```

### Submission Lifecycle

```
NOT_SUBMITTED → SUBMITTED → UNDER_REVIEW → GRADED → RETURNED
                                          └→ RESUBMISSION_REQUESTED → RESUBMITTED → GRADED
```

### Grading Model

```
submissions
  score: numeric (0 to assignment.max_score)
  graded_by: user_id (instructor)
  graded_at: timestamp
  feedback: text (private, to student)
  public_feedback: text (visible on parent portal)
  rubric_scores: JSONB (per-criterion scores)
  status: enum
```

### Grade Calculation

```
student_grade_summaries (materialized or computed)
  student_id, course_id, group_course_id
  total_assignments, submitted_count, graded_count
  total_possible_score, earned_score
  grade_percentage, letter_grade
  last_updated_at
```

---

## 13. Student Progress System

### Progress Tracking Model

```
lesson_completions
  student_id, lesson_id, completed_at, time_spent_seconds, attempts

student_progress (per course)
  student_id, course_id, group_course_id
  completed_lessons, total_lessons
  completion_percentage
  last_activity_at
  started_at, completed_at (course level)

student_grade_summaries (per group_course)
  student_id, group_course_id
  avg_grade, total_score, assignments_submitted
```

### Progress Events

All progress events are emitted to `analytics_events`:

```
event: 'lesson_started'     — student opens lesson
event: 'lesson_completed'   — student marks complete or quiz passed
event: 'assignment_submitted'
event: 'quiz_passed'
event: 'quiz_failed'
event: 'course_completed'   — 100% lessons done + all assignments submitted
```

### At-Risk Detection (future AI hook)

```
A student is flagged at-risk if:
  - attendance_rate < 70% in last 4 weeks
  - assignment_submission_rate < 60%
  - no lesson activity in 14+ days
  - grade_percentage < 50%

→ triggers: notification to instructor + team leader
→ AI recommendation generated (Phase 7)
```

---

## 14. Parent Portal Architecture

### What Parents Can Access

| Feature | Data Source | Visibility |
|---|---|---|
| Child's attendance | attendance_records | Their child only |
| Upcoming schedule | schedules + group_students | Their child's groups |
| Progress by course | student_progress | Their child only |
| Grades | student_grade_summaries | Their child only |
| Instructor feedback | feedback_notes (visible_to_parent = true) | Their child only |
| Invoices & payments | invoices, payments | Their child only |
| Announcements | announcements (branch/group) | Their child's branch/groups |
| Messages | messages | Between parent and staff only |

### Parent-Child Linking

```
parents (user_id) ──► parent_students ◄── students (id)
                          └── relationship: 'father' | 'mother' | 'guardian' | 'other'
                          └── is_primary: boolean
                          └── can_view_financials: boolean
                          └── can_receive_notifications: boolean
```

Multiple parents can be linked to one student. Each parent independently controls their notification preferences.

### Parent Registration Flow

```
1. Team Leader creates student record
2. Team Leader adds parent info (name, email, phone)
3. System sends magic link invitation to parent
4. Parent creates account, auto-linked to student
5. Parent portal access granted
```

---

## 15. Notification System

### Notification Channels

```
notifications
  id, type, title, body, data (JSONB), created_by, created_at

notification_recipients
  notification_id, user_id, channel, delivered_at, read_at, failed_at
  
  channel ENUM: 'in_app' | 'email' | 'sms' | 'push'
```

### Trigger Events

| Event | Recipients | Channels |
|---|---|---|
| Attendance marked absent | Student, Parent | Email, In-app |
| New assignment published | Students in group | In-app |
| Assignment due in 24h | Student | In-app, Email |
| Assignment graded | Student, Parent | In-app |
| New announcement | Branch/Group members | In-app |
| Invoice created | Parent | Email, In-app |
| Payment overdue | Parent | Email, SMS |
| Session cancelled | All group members | Email, In-app |
| Makeup session scheduled | Student, Parent | Email, In-app |
| Student at-risk flagged (AI) | Instructor, Team Leader | In-app |

### Notification Processing

```
Trigger event
  → create notification record
  → create notification_recipient rows (one per user per channel)
  → Supabase Edge Function processes queue:
      - in_app: written to DB, Supabase Realtime pushes to client
      - email: Resend API
      - sms: Twilio (future)
      - push: Web Push / FCM (future)
```

### Preference Management

```
notification_preferences
  user_id, channel, event_type, enabled
```

---

## 16. Analytics Architecture

### Event-Driven Architecture

All user actions emit events to `analytics_events`:

```sql
analytics_events
  id, user_id, branch_id, session_id, event_name,
  properties JSONB, device_type, created_at
```

Never aggregate in the events table. Query or materialize aggregates separately.

### Key Metrics by Domain

**Attendance Analytics**
```
- attendance_rate per student, group, branch, time period
- absent_rate trends
- late_rate trends
- makeup_completion_rate
- chronic_absentee_list (< 70% last 30 days)
```

**Academic Performance**
```
- avg_grade per course, group, instructor
- assignment_completion_rate
- quiz_pass_rate
- course_completion_rate
- grade_distribution histogram
```

**Engagement Analytics**
```
- lesson_completion_rate
- avg_time_per_lesson
- login_frequency per student
- resource_download_count
- forum_activity (future)
```

**Instructor Performance**
```
- avg_class_attendance_rate
- avg_student_grade (their classes)
- assignment_grading_turnaround (submitted → graded days)
- student_satisfaction_score (future survey)
- content_completion_rate (their courses)
```

**Retention Analytics**
```
- enrollment_to_completion_rate
- dropout_rate per group, branch, semester
- re-enrollment_rate
- cohort_retention_curves
```

**Branch Analytics**
```
- total_active_students
- monthly_enrollment_count
- revenue_by_month
- instructor_utilization_rate
- room_utilization (offline branches)
```

### Analytics Tables

```
analytics_snapshots
  id, snapshot_type, entity_type, entity_id, period,
  metrics JSONB, computed_at

  snapshot_type: 'daily' | 'weekly' | 'monthly'
  entity_type: 'branch' | 'group' | 'instructor' | 'student' | 'course'
```

Snapshots are computed by a scheduled Edge Function (nightly/weekly). Dashboards read from snapshots, not from raw events, for performance.

---

## 17. Media & Storage Architecture

### Video Infrastructure Decision

**Videos are NOT stored in Supabase Storage.** All educational video content and session recordings use external providers. The platform stores only metadata and links.

| Video Type | Storage Location | How Stored |
|---|---|---|
| Educational lesson videos | Google Drive / YouTube / Vimeo | `external_videos` table: link + metadata |
| Session recordings | Google Drive / Zoom Cloud / Vimeo | `session_recordings` table: provider link |
| Short clips / previews | External provider | `external_videos` table |

**Rationale:**
- Supabase Storage has file size limits unsuitable for video (lesson videos can be GBs)
- External providers (Google Drive, YouTube) handle transcoding, adaptive streaming, CDN
- Cost: storing GB of video in Supabase is prohibitively expensive
- Educators already use Google Drive and YouTube in their workflows

### `external_videos` Table

```sql
external_videos
  id, branch_id, uploader_id,
  title, description,
  provider: 'google_drive' | 'youtube' | 'vimeo' | 'zoom_cloud' | 'other'
  external_url    -- shareable link
  external_id     -- provider video ID
  embed_url       -- computed embed URL
  thumbnail_url, duration_seconds,
  entity_type: 'lesson' | 'schedule_recording' | 'resource'
  entity_id       -- links to lesson/schedule
  is_public, requires_auth
  deleted_at, created_at
```

### `session_recordings` Table

```sql
session_recordings
  id, schedule_id, branch_id,
  title, provider, external_url, external_id,
  duration_seconds, recorded_by,
  visible_to_students: boolean
  visible_to_parents: boolean
  expires_at    -- access expiry (null = forever)
  created_at
```

### Supabase Storage Buckets (Non-Video Only)

| Bucket | Contents | Access |
|---|---|---|
| `avatars` | User profile pictures | Public (resized via CDN) |
| `course-resources` | PDFs, documents attached to lessons | Signed URL (authenticated) |
| `submissions` | Student file submissions | Private (student + instructor + admin) |
| `thumbnails` | Course/branch cover images | Public |
| `branch-assets` | Branch logos, documents | Signed URL |

### File Size Limits (Supabase Storage)

| Type | Max Size |
|---|---|
| Avatar | 5 MB |
| Document/PDF | 50 MB |
| Submission file | 100 MB |
| Thumbnail/image | 10 MB |

---

## 18. Audit Logs

### Architecture

```sql
audit_logs
  id, performed_by, impersonated_by (if admin acting as user),
  action, entity_type, entity_id,
  old_values JSONB, new_values JSONB,
  ip_address, user_agent, request_id,
  branch_id, created_at
  
  -- NEVER updated or deleted (append-only)
  -- Partitioned by month for performance
```

### Audited Actions

| Category | Actions Logged |
|---|---|
| Auth | login, logout, password_change, mfa_enabled, failed_login |
| Users | created, updated, deactivated, role_assigned, role_removed |
| Students | enrolled, dropped, transferred, status_changed |
| Attendance | recorded, edited, deleted (with who changed it) |
| Grades | submitted, edited (with before/after values) |
| Financials | invoice_created, payment_recorded, discount_applied |
| Permissions | permission_granted, permission_revoked |
| Content | course_published, lesson_deleted, resource_uploaded |
| Settings | branch_settings_changed, org_settings_changed |

### Audit Log Access

- Super Admin: all logs
- Team Leader: their branch logs only
- Others: no access

---

## 19. Dashboard Structure per Role

### Super Admin Dashboard

```
┌─ System Overview ───────────────────────────────────────────┐
│  Total Students  |  Total Instructors  |  Active Branches   │
│  MRR             |  New Enrollments    |  Churn Rate         │
├─ Branch Performance ────────────────────────────────────────┤
│  Table: Branch | Students | Attendance% | Revenue | Status  │
├─ System Health ─────────────────────────────────────────────┤
│  DB size | Storage usage | Edge function errors             │
├─ Recent Audit Activity ────────────────────────────────────┤
│  Last 20 critical actions with user + timestamp             │
└─────────────────────────────────────────────────────────────┘

Quick actions: Create Branch | Manage Roles | View All Logs
```

### Team Leader Dashboard

```
┌─ Branch Overview ───────────────────────────────────────────┐
│  Active Students  |  Active Instructors  |  Active Groups    │
│  This Month Revenue  |  Attendance Rate  |  Pending Payments │
├─ Today's Schedule ─────────────────────────────────────────┤
│  List of today's sessions: group, time, instructor, status  │
├─ At-Risk Students ─────────────────────────────────────────┤
│  Students with low attendance or grades — action required   │
├─ Instructor Load ──────────────────────────────────────────┤
│  Table: Instructor | Groups | Students | Avg Attendance     │
├─ Pending Actions ──────────────────────────────────────────┤
│  Ungraded submissions | Overdue invoices | Makeup requests   │
└─────────────────────────────────────────────────────────────┘

Quick actions: Add Student | Create Group | Schedule Makeup
```

### Instructor Dashboard

```
┌─ Today ─────────────────────────────────────────────────────┐
│  Next class: Group A — Robotics — 3:00 PM — Room 2          │
├─ My Classes ───────────────────────────────────────────────┤
│  List of groups with attendance rate, last session date     │
├─ Pending Grading ──────────────────────────────────────────┤
│  List: Student | Assignment | Submitted | Days Waiting      │
├─ Student Progress ─────────────────────────────────────────┤
│  Progress bars per course — flag students < 60%             │
├─ Recent Attendance ────────────────────────────────────────┤
│  Last session per group with attendance breakdown           │
└─────────────────────────────────────────────────────────────┘

Quick actions: Take Attendance | Grade Submissions | Add Feedback
```

### Student Dashboard

```
┌─ Welcome Back ──────────────────────────────────────────────┐
│  Next class: Robotics — Tuesday 3:00 PM                     │
├─ My Progress ──────────────────────────────────────────────┤
│  Course progress bars with lesson counts                    │
├─ Due Soon ─────────────────────────────────────────────────┤
│  Assignments due in next 7 days                             │
├─ My Attendance ────────────────────────────────────────────┤
│  Current month attendance rate + calendar heatmap           │
├─ Recent Grades ────────────────────────────────────────────┤
│  Last 5 graded assignments with score + feedback            │
├─ Announcements ────────────────────────────────────────────┤
│  Latest from instructors and branch                         │
└─────────────────────────────────────────────────────────────┘

Quick actions: Continue Learning | Submit Assignment
```

### Parent Dashboard

```
┌─ [Child Name]'s Overview ───────────────────────────────────┐
│  Attendance Rate  |  Avg Grade  |  Courses Enrolled         │
│  Next Class       |  Balance Due                            │
├─ Attendance Calendar ──────────────────────────────────────┤
│  Monthly view: present (green) / absent (red) / late (yellow)│
├─ Recent Grades ────────────────────────────────────────────┤
│  Assignment | Score | Feedback (if shared by instructor)    │
├─ Upcoming Schedule ────────────────────────────────────────┤
│  Next 7 days of sessions                                    │
├─ Payments ─────────────────────────────────────────────────┤
│  Outstanding invoices + payment history                     │
├─ Instructor Notes ─────────────────────────────────────────┤
│  Feedback notes marked visible_to_parent = true             │
└─────────────────────────────────────────────────────────────┘

Quick actions: Contact Instructor | View Schedule | Pay Invoice
```

---

## 20. AI Integration Points

### Planned AI Agents (Phase 7+)

```
AI_AGENTS = {
  'attendance_monitor': {
    trigger: 'nightly cron',
    input: attendance data for last 30 days,
    output: at-risk student list + reason codes,
    stores: ai_recommendations table
  },
  
  'grade_assistant': {
    trigger: 'submission created',
    input: assignment rubric + student submission,
    output: suggested score + feedback draft,
    stores: ai_grade_suggestions table (instructor reviews before applying)
  },
  
  'progress_reporter': {
    trigger: 'parent requests / weekly cron',
    input: student's last 4 weeks data,
    output: natural language progress report,
    stores: ai_reports table
  },
  
  'learning_recommender': {
    trigger: 'lesson completed / quiz failed',
    input: student progress + quiz results,
    output: next recommended lesson or remedial content,
    stores: ai_recommendations table
  },
  
  'content_assistant': {
    trigger: 'instructor creates lesson',
    input: lesson title + module context,
    output: suggested content outline + quiz questions,
    stores: temp (not persisted unless instructor accepts)
  },
  
  'engagement_predictor': {
    trigger: 'weekly',
    input: login frequency + lesson activity + attendance,
    output: engagement score per student + dropout risk flag,
    stores: analytics_snapshots
  }
}
```

### AI Infrastructure Requirements

| Component | Technology | Purpose |
|---|---|---|
| LLM API | Anthropic Claude | All AI generation |
| Embeddings | `pgvector` extension | Semantic search on content |
| Agent orchestration | LangGraph or Vercel AI SDK | Multi-step AI workflows |
| AI job queue | Supabase Edge Functions + pg_cron | Scheduled AI tasks |
| AI log | `ai_interactions` table | Cost tracking, debugging |

### AI Tables

```sql
ai_interactions
  id, user_id, agent_type, input_tokens, output_tokens,
  model, latency_ms, cost_usd, input_hash (dedup),
  created_at

ai_recommendations
  id, student_id, generated_by_agent, recommendation_type,
  content JSONB, confidence_score, reviewed_by, acted_upon,
  created_at, expires_at

ai_reports
  id, student_id, report_type, period_start, period_end,
  content TEXT, generated_at, viewed_by_parent_at

vector_embeddings
  id, entity_type, entity_id, embedding vector(1536),
  model_version, created_at
```

---

## 21. Complete Table Definitions

### Identity & Access

```sql
-- users: mirrors auth.users from Supabase Auth
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  email       TEXT NOT NULL UNIQUE,
  phone       TEXT,
  avatar_url  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  display_name     TEXT,
  date_of_birth    DATE,
  gender           TEXT,
  nationality      TEXT,
  language_pref    TEXT DEFAULT 'ar',
  bio              TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,  -- 'super_admin', 'team_leader', 'instructor', 'student', 'parent'
  description TEXT,
  is_system   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,  -- 'manage_attendance', etc.
  description TEXT,
  category    TEXT,  -- 'academic', 'financial', 'system', etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id),
  branch_id   UUID REFERENCES branches(id) ON DELETE CASCADE,  -- NULL = global
  assigned_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role_id, branch_id)
);
```

### Organization Structure

```sql
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('online', 'offline', 'hybrid')),
  location_data   JSONB DEFAULT '{}',  -- address, city, maps_url, room_count
  timezone        TEXT DEFAULT 'Africa/Cairo',
  settings        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE semesters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,   -- 'org' | 'branch' | 'user'
  entity_id   UUID NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_type, entity_id, key)
);
```

### People

```sql
CREATE TABLE students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  student_code    TEXT,  -- human-readable ID
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'paused', 'banned')),
  notes           TEXT,
  emergency_contact JSONB DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE TABLE instructors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  employee_id     TEXT,
  hire_date       DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  specializations TEXT[],
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE TABLE parents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE parent_students (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id                UUID NOT NULL REFERENCES parents(id),
  student_id               UUID NOT NULL REFERENCES students(id),
  relationship             TEXT DEFAULT 'guardian' CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  is_primary               BOOLEAN DEFAULT false,
  can_view_financials      BOOLEAN DEFAULT true,
  can_receive_notifications BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE (parent_id, student_id)
);
```

### Academic Structure

```sql
CREATE TABLE groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  semester_id     UUID REFERENCES semesters(id),
  name            TEXT NOT NULL,
  code            TEXT,
  type            TEXT DEFAULT 'class' CHECK (type IN ('class', 'workshop', 'bootcamp', 'trial', 'makeup')),
  capacity        INTEGER,
  waitlist_capacity INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('forming', 'active', 'completed', 'cancelled')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE group_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id),
  student_id  UUID NOT NULL REFERENCES students(id),
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'graduated', 'paused', 'waitlisted')),
  joined_at   TIMESTAMPTZ DEFAULT now(),
  left_at     TIMESTAMPTZ,
  UNIQUE (group_id, student_id)
);

CREATE TABLE group_instructors (
  group_id      UUID NOT NULL REFERENCES groups(id),
  instructor_id UUID NOT NULL REFERENCES instructors(id),
  role          TEXT DEFAULT 'lead' CHECK (role IN ('lead', 'assistant')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, instructor_id)
);
```

### Curriculum

```sql
CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES branches(id),  -- NULL = global template
  title           TEXT NOT NULL,
  description     TEXT,
  code            TEXT,
  category        TEXT,
  level           TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  estimated_hours INTEGER,
  thumbnail_url   TEXT,
  scope           TEXT DEFAULT 'branch' CHECK (scope IN ('branch', 'template', 'global')),
  is_published    BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES users(id),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE group_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id),
  course_id     UUID NOT NULL REFERENCES courses(id),
  instructor_id UUID REFERENCES instructors(id),
  start_date    DATE,
  end_date      DATE,
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, course_id)
);

CREATE TABLE course_modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  is_published BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         JSONB,  -- rich text, embeds, structured content
  type            TEXT DEFAULT 'text' CHECK (type IN ('video', 'text', 'live', 'quiz', 'mixed')),
  duration_minutes INTEGER,
  order_index     INTEGER NOT NULL,
  video_url       TEXT,   -- external or signed storage URL
  is_published    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lesson_resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  type          TEXT CHECK (type IN ('pdf', 'link', 'video', 'image', 'other')),
  url           TEXT,
  storage_key   TEXT,
  size_bytes    BIGINT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lesson_completions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id         UUID NOT NULL REFERENCES lessons(id),
  student_id        UUID NOT NULL REFERENCES students(id),
  completed_at      TIMESTAMPTZ DEFAULT now(),
  time_spent_seconds INTEGER,
  UNIQUE (lesson_id, student_id)
);

CREATE TABLE student_progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES students(id),
  group_course_id       UUID NOT NULL REFERENCES group_courses(id),
  completed_lessons     INTEGER DEFAULT 0,
  total_lessons         INTEGER DEFAULT 0,
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  last_activity_at      TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  UNIQUE (student_id, group_course_id)
);
```

### Scheduling & Attendance

```sql
CREATE TABLE schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_course_id UUID NOT NULL REFERENCES group_courses(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  type            TEXT DEFAULT 'regular' CHECK (type IN ('regular', 'makeup', 'exam', 'event')),
  delivery        TEXT CHECK (delivery IN ('online', 'offline', 'hybrid')),
  meeting_url     TEXT,
  room            TEXT,
  status          TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  cancellation_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     UUID NOT NULL REFERENCES schedules(id),
  student_id      UUID NOT NULL REFERENCES students(id),
  status          TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'makeup')),
  late_minutes    INTEGER,
  recorded_by     UUID NOT NULL REFERENCES users(id),
  recorded_at     TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  makeup_session_id UUID REFERENCES schedules(id),
  UNIQUE (schedule_id, student_id)
);
```

### Assessments

```sql
CREATE TABLE assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID REFERENCES lessons(id),
  module_id     UUID REFERENCES course_modules(id),  -- OR lesson, not both
  title         TEXT NOT NULL,
  description   TEXT,
  instructions  TEXT,
  type          TEXT DEFAULT 'homework' CHECK (type IN ('homework', 'classwork', 'project', 'quiz', 'exam')),
  max_score     NUMERIC(6,2) DEFAULT 100,
  due_at        TIMESTAMPTZ,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  allow_late    BOOLEAN DEFAULT false,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES assignments(id),
  student_id      UUID NOT NULL REFERENCES students(id),
  submitted_at    TIMESTAMPTZ DEFAULT now(),
  content         TEXT,
  file_keys       TEXT[],
  score           NUMERIC(6,2),
  graded_by       UUID REFERENCES users(id),
  graded_at       TIMESTAMPTZ,
  feedback        TEXT,
  public_feedback TEXT,
  rubric_scores   JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'graded', 'returned', 'resubmission_requested', 'resubmitted')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE student_grade_summaries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES students(id),
  group_course_id       UUID NOT NULL REFERENCES group_courses(id),
  total_assignments     INTEGER DEFAULT 0,
  submitted_count       INTEGER DEFAULT 0,
  graded_count          INTEGER DEFAULT 0,
  total_possible_score  NUMERIC(8,2) DEFAULT 0,
  earned_score          NUMERIC(8,2) DEFAULT 0,
  grade_percentage      NUMERIC(5,2),
  last_updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, group_course_id)
);
```

### Communication

```sql
CREATE TABLE announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID REFERENCES branches(id),
  group_id      UUID REFERENCES groups(id),  -- NULL = branch-wide
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(id),
  published_at  TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  is_pinned     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE feedback_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id),
  instructor_id     UUID NOT NULL REFERENCES instructors(id),
  group_id          UUID REFERENCES groups(id),
  content           TEXT NOT NULL,
  rating            INTEGER CHECK (rating BETWEEN 1 AND 5),
  visible_to_parent BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notification_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  channel         TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Financials

```sql
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  invoice_number  TEXT NOT NULL UNIQUE,
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'EGP',
  due_date        DATE,
  status          TEXT DEFAULT 'unpaid' CHECK (status IN ('draft', 'unpaid', 'partial', 'paid', 'cancelled', 'overdue')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  amount          NUMERIC(10,2) NOT NULL,
  payment_method  TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'online', 'other')),
  reference       TEXT,
  paid_at         TIMESTAMPTZ DEFAULT now(),
  recorded_by     UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Audit

```sql
CREATE TABLE audit_logs (
  id              BIGSERIAL PRIMARY KEY,  -- integer for append-only perf
  performed_by    UUID REFERENCES users(id),
  impersonated_by UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  branch_id       UUID REFERENCES branches(id),
  created_at      TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Monthly partitions created by cron
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Analytics

```sql
CREATE TABLE analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  branch_id   UUID REFERENCES branches(id),
  session_id  TEXT,
  event_name  TEXT NOT NULL,
  properties  JSONB DEFAULT '{}',
  device_type TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE analytics_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type   TEXT CHECK (snapshot_type IN ('daily', 'weekly', 'monthly')),
  entity_type     TEXT CHECK (entity_type IN ('branch', 'group', 'instructor', 'student', 'course')),
  entity_id       UUID NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  metrics         JSONB NOT NULL,
  computed_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (snapshot_type, entity_type, entity_id, period_start)
);
```

### Media

```sql
CREATE TABLE media_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id       UUID NOT NULL REFERENCES users(id),
  branch_id         UUID REFERENCES branches(id),
  bucket            TEXT NOT NULL,
  storage_key       TEXT NOT NULL UNIQUE,
  original_filename TEXT,
  mime_type         TEXT,
  size_bytes        BIGINT,
  duration_seconds  INTEGER,
  width             INTEGER,
  height            INTEGER,
  metadata          JSONB DEFAULT '{}',
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## 22. Permission Matrix

See [Section 6](#6-rbac-permissions-system) for the full permission table.

### RLS Policy Patterns

```sql
-- Pattern 1: Branch isolation (most common)
USING (
  branch_id IN (
    SELECT branch_id FROM user_roles
    WHERE user_id = auth.uid()
    AND branch_id IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
    AND ur.branch_id IS NULL  -- global role
    AND p.name = 'manage_system'
  )
)

-- Pattern 2: Student sees own data
USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
)

-- Pattern 3: Parent sees child data
USING (
  student_id IN (
    SELECT ps.student_id FROM parent_students ps
    JOIN parents p ON p.id = ps.parent_id
    WHERE p.user_id = auth.uid()
  )
)

-- Pattern 4: Instructor sees their groups' data
USING (
  schedule_id IN (
    SELECT s.id FROM schedules s
    JOIN group_courses gc ON gc.id = s.group_course_id
    JOIN group_instructors gi ON gi.group_id = gc.group_id
    JOIN instructors i ON i.id = gi.instructor_id
    WHERE i.user_id = auth.uid()
  )
)
```

---

## 23. Scalability Concerns

### Database

| Concern | Solution |
|---|---|
| `analytics_events` table grows unbounded | Partition by month; archive cold data to S3 |
| `audit_logs` append-only growth | Partition by month; keep 2 years hot |
| Complex RLS queries slow on large datasets | Indexed `user_id`, `branch_id`, `student_id` on all join tables |
| Snapshot computation blocking | Run via Edge Function on off-peak hours |
| JSONB queries without index | Use `GIN` index on `properties` and `metadata` columns |

### Application

| Concern | Solution |
|---|---|
| Permission check on every request | Cache permission set in JWT claims (refreshed on role change) |
| Media serving via API | Use signed Supabase URLs with 1-hour TTL; CDN in front |
| Realtime notifications at scale | Supabase Realtime → upgrade to dedicated channel per user |
| File upload size | Chunked uploads via Supabase's TUS protocol |
| Report generation for large data | Move to background Edge Function; stream result |

### Key Indexes

```sql
-- All frequently queried foreign keys
CREATE INDEX ON group_students (student_id);
CREATE INDEX ON group_students (group_id);
CREATE INDEX ON attendance_records (student_id);
CREATE INDEX ON attendance_records (schedule_id);
CREATE INDEX ON submissions (student_id);
CREATE INDEX ON submissions (assignment_id);
CREATE INDEX ON user_roles (user_id);
CREATE INDEX ON user_roles (branch_id);
CREATE INDEX ON analytics_events (user_id, created_at);
CREATE INDEX ON notification_recipients (user_id, read_at);

-- JSONB indexes
CREATE INDEX ON analytics_events USING GIN (properties);
CREATE INDEX ON settings USING GIN (value);
```

---

## 24. Security Concerns

### Authentication

- All routes server-side protected via `createServerClient()` session check
- No client-side-only auth checks — always validate server-side
- JWT custom claims validated against DB on sensitive operations (not just trusted from JWT)
- Rate limiting on auth endpoints (Supabase built-in + Edge Function middleware)

### Authorization

- RLS is the **primary** security layer, not the app layer
- Never `SELECT *` in server actions — always specify columns
- Parameterized queries only — no string concatenation in SQL
- Admin impersonation tracked in `audit_logs.impersonated_by`

### Data

- Sensitive fields encrypted at rest (Supabase handles this)
- PII fields (DOB, phone) never returned in list queries — only detail views
- File downloads always through signed URLs, never direct bucket access
- Student data never exposed in client-side bundles

### API

- Server Actions used over API Routes where possible (CSRF protected)
- Input validation via Zod on all form inputs and server action params
- File upload: validate mime type server-side (not just extension)
- Rate limiting per user on submission and notification endpoints

### Multi-Tenancy

- Branch data isolation enforced at DB level (RLS), not application level
- A bug in application code cannot leak cross-branch data due to RLS
- Super Admin actions are double-audited

---

## 25. Recommended Build Phases

### Phase 0 — Foundation (Week 1-2)
- [ ] DB schema creation (all tables, indexes, RLS)
- [ ] Supabase Auth setup with custom claims hook
- [ ] RBAC library: `hasPermission()`, `getUserPermissions()`
- [ ] Role-based route protection middleware
- [ ] Seed roles and permissions

### Phase 1 — Organization Setup (Week 3-4)
- [ ] Organization and branch management (Super Admin)
- [ ] User management: create/invite users
- [ ] Role assignment UI (Super Admin)
- [ ] Branch settings

### Phase 2 — People & Groups (Week 5-7)
- [ ] Student enrollment and profiles
- [ ] Instructor profiles
- [ ] Parent registration and linking
- [ ] Semesters and group creation
- [ ] Student ↔ Group enrollment
- [ ] Instructor ↔ Group assignment

### Phase 3 — Curriculum (Week 8-10)
- [ ] Course creation and management
- [ ] Module and lesson builder
- [ ] Resource attachments
- [ ] Course assignment to groups
- [ ] Student course access

### Phase 4 — Scheduling & Attendance (Week 11-13)
- [ ] Schedule builder (recurring and one-off)
- [ ] Attendance recording (manual + QR)
- [ ] Makeup session flow
- [ ] Attendance reports

### Phase 5 — Assessments & Grades (Week 14-16)
- [ ] Assignment creation and publishing
- [ ] Student submission flow
- [ ] Grading interface
- [ ] Grade summaries and reports
- [ ] Quizzes (basic MCQ)

### Phase 6 — Portals & Communication (Week 17-19)
- [ ] Student dashboard with progress
- [ ] Parent portal (all read views)
- [ ] Notifications (in-app + email)
- [ ] Announcements
- [ ] Instructor feedback notes

### Phase 7 — Analytics & Reporting (Week 20-22)
- [ ] Analytics event tracking
- [ ] Snapshot computation jobs
- [ ] Admin analytics dashboard
- [ ] Attendance report exports
- [ ] Student progress reports

### Phase 8 — Financials (Week 23-24)
- [ ] Invoice creation
- [ ] Payment recording
- [ ] Financial reports
- [ ] Parent payment view

### Phase 9 — AI Integration (Post-Launch)
- [ ] pgvector setup + content embeddings
- [ ] At-risk student detection agent
- [ ] AI progress report generator
- [ ] AI grade suggestion assistant
- [ ] AI learning recommender

---

## 26. Technical Recommendations

### 1. Use Server Actions over API Routes
Next.js 16 Server Actions are CSRF-protected, type-safe, and co-located with components. Use them for all mutations.

### 2. Supabase Service Role for Admin Actions
Super Admin operations that bypass RLS must use `createServiceRoleClient()` explicitly, never on the client side, always in Server Actions or Edge Functions.

### 3. Database Function for Permission Checks
Create a PostgreSQL function `user_has_permission(user_uuid, permission_name, branch_uuid)` that RLS policies can call — centralizes the logic, avoids duplication across 30+ policies.

### 4. Type Generation
Run `supabase gen types typescript` and keep `types/database.ts` current. All DB queries typed end-to-end.

### 5. Zod Schemas Co-located with Tables
For each table group, maintain a Zod schema file at `lib/schemas/{group}.ts`. Use these for both server-side validation and TypeScript types.

### 6. Soft Delete Pattern
Never hard-delete students, courses, or instructors. Use `deleted_at` timestamp. Filter in queries with `WHERE deleted_at IS NULL`. Soft-deleted records preserved for audit and reporting.

### 7. Optimistic UI for Attendance
Attendance recording should feel instant. Use Supabase Realtime to sync across instructors marking the same session.

### 8. Event Sourcing for Analytics
Never derive analytics from joins across production tables. Emit events, compute snapshots, query snapshots.

### 9. Environment Configuration
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   ← server-only, never expose
RESEND_API_KEY
NEXT_PUBLIC_APP_URL
```

### 10. File Structure for LMS

```
app/
  (auth)/               ← login, signup, magic-link
  (dashboard)/
    admin/              ← super admin
    branch/             ← team leader
    instructor/         ← instructor
    student/            ← student
    parent/             ← parent
  api/                  ← minimal, prefer Server Actions

lib/
  rbac.ts               ← hasPermission(), getUserPermissions()
  supabase/
    client.ts
    server.ts
    service.ts          ← service role client (server-only)
  schemas/              ← Zod schemas per table group
  
types/
  database.ts           ← generated from supabase gen types
  app.ts                ← app-level types

actions/                ← Server Actions per domain
  students.ts
  attendance.ts
  courses.ts
  ...
```

---

---

## Appendix: Confirmed Decisions (v1.1)

These decisions were confirmed and incorporated into the Phase 0 implementation.

### A. Financial System

The financial system is designed for **full capability from day one**, even if UI implementation comes in Phase 8. Tables exist for:

| Capability | Table(s) |
|---|---|
| Basic invoicing | `invoices`, `invoice_items` |
| Subscription plans | `subscription_plans` |
| Installments | `installment_plans`, `installments` |
| Discounts & coupons | `discounts` |
| Payment recording | `payments` |
| Refunds | `payments.is_refund`, `payments.refunds_payment` |
| Instructor payouts | `instructor_payouts` |
| Overdue tracking | `invoices.status = 'overdue'` via `check_invoice_overdue()` pg_cron |
| Branch pricing | `subscription_plans.branch_id` |

See migration: `supabase/migrations/0009_financials.sql`

### B. Video Infrastructure

**Decision: Videos are NOT stored in Supabase Storage.**

All educational videos and session recordings are hosted on external providers. The platform stores only metadata and access-controlled links.

| Type | Where Stored | Platform Stores |
|---|---|---|
| Lesson videos | Google Drive / YouTube / Vimeo | `external_videos` table: URL + metadata |
| Session recordings | Google Drive / Zoom Cloud | `session_recordings` table: provider URL + access flags |
| Short clips | Any external provider | `external_videos` table |

**Access control for recordings:**
- `session_recordings.visible_to_students` — toggle per recording
- `session_recordings.visible_to_parents` — toggle per recording
- `session_recordings.expires_at` — time-limited access
- RLS policies enforce these flags at DB level

See migration: `supabase/migrations/0010_media_videos.sql`

### C. Search System

Global search is built on **PostgreSQL native FTS** (pg_trgm + tsvector):

- `search_index` view — unified view across all searchable entity types
- `search_entities(query, branch_id, types, limit)` — DB function used by `/api/search`
- GIN trigram indexes on name/title columns for fuzzy matching

**Searchable entities:**
`student`, `instructor`, `parent`, `group`, `course`, `lesson`, `assignment`, `announcement`

Future (Phase 9): `pgvector` semantic search for AI-powered content discovery.

See migration: `supabase/migrations/0014_search_indexes.sql`

### D. Localization

- All database schema, column names, constraint names, and enum values are **English-only**
- All user-facing strings use the existing `messages/` i18n system
- `profiles.language_pref` stores the user's preferred language (`ar` default)
- No Arabic text is stored in the database — translations happen at the application layer

### E. Project Structure

Full refactor plan documented in `docs/PROJECT-STRUCTURE.md`. Key structural changes:
- Current `/admin` (CMS) → `/cms` (preserve password auth)
- New `/admin` → LMS Super Admin (Supabase Auth + RBAC)
- New `/branch`, `/instructor`, `/student`, `/parent` portals
- `modules/` directory: domain logic, no React imports allowed
- `middleware.ts`: route-level auth + role routing
- `lib/supabase/service.ts`: service role client, server-only

---

*End of Architecture Blueprint v1.1*  
*Phase 0 implementation is underway. See supabase/migrations/ for schema.*
