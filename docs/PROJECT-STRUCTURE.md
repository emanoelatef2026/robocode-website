# Robocode — Project Structure Refactor Plan

**Version:** 1.0  
**Date:** 2026-05-25  
**Status:** Approved — Ready for execution  
**Applies to:** Transition from marketing website → LMS + Educational Operating System

---

## Table of Contents

1. [Strategic Context](#1-strategic-context)
2. [Current State Assessment](#2-current-state-assessment)
3. [Target Structure](#3-target-structure)
4. [Module Boundaries](#4-module-boundaries)
5. [Portal Architecture](#5-portal-architecture)
6. [CMS Architecture](#6-cms-architecture)
7. [API Organization Strategy](#7-api-organization-strategy)
8. [Auth & Session Architecture](#8-auth--session-architecture)
9. [RBAC Middleware Placement](#9-rbac-middleware-placement)
10. [Server Actions Strategy](#10-server-actions-strategy)
11. [Data Access Layer](#11-data-access-layer)
12. [Naming Conventions](#12-naming-conventions)
13. [Scalability Safeguards](#13-scalability-safeguards)
14. [Migration Strategy from Current Structure](#14-migration-strategy-from-current-structure)
15. [File-by-File Migration Map](#15-file-by-file-migration-map)

---

## 1. Strategic Context

The project serves four distinct systems with fundamentally different access patterns:

| System | Users | Auth Model | URL Space |
|---|---|---|---|
| Marketing Website | Public | None | `/`, `/blog`, `/book-session` |
| Marketing CMS | 1 admin | Password cookie | `/cms` |
| LMS Platform | Students, Instructors, Parents, Branch Managers, Super Admin | Supabase Auth + RBAC | `/student`, `/instructor`, `/parent`, `/branch`, `/admin` |
| Future AI/Analytics | Internal | Service role | `/api/internal` |

These must be **structurally isolated** from each other. A bug in the marketing site must not be able to touch LMS data. A student portal bug must not be able to expose another student's data.

---

## 2. Current State Assessment

### What Exists Today

```
app/
  admin/          ← Marketing CMS (password-based, single admin user)
  api/admin/      ← CMS API routes
  blog/           ← Marketing blog
  book-session/   ← Trial booking form
  page.tsx        ← Marketing homepage

components/
  *.tsx           ← All flat in root (marketing components)
  admin/          ← CMS-specific components
  ui/             ← Primitive components

lib/
  supabase/       ← client.ts + server.ts only
  analytics.ts
  i18n.ts

contexts/
  LanguageContext.tsx
```

### Problems with Current Structure

1. **No separation** between marketing and LMS — everything flat in `components/`
2. **Primitive auth** — single password cookie, no Supabase Auth integration
3. **No module boundaries** — business logic mixed into API routes and components
4. **No types layer** — no generated DB types, no Zod validation
5. **No middleware** — no route-level auth protection
6. **Naming collision** — `admin/` is CMS today but must become LMS Super Admin
7. **No server-side data access layer** — all queries are ad-hoc per route
8. **No RBAC** — no permission system exists

### What Must Be Preserved

- All existing marketing pages and functionality (routes must not change)
- Existing CMS functionality (blog, branches, gallery management etc.)
- Supabase connection (reuse existing client)
- i18n system (LanguageContext + messages/)
- Analytics setup

---

## 3. Target Structure

```
robocode-new/
│
├── app/
│   │
│   ├── (marketing)/                  ← PUBLIC: Marketing website (no auth)
│   │   ├── layout.tsx                ← Marketing layout: Navbar + Footer
│   │   ├── page.tsx                  → /
│   │   ├── blog/
│   │   │   ├── page.tsx              → /blog
│   │   │   └── [slug]/
│   │   │       └── page.tsx          → /blog/[slug]
│   │   └── book-session/
│   │       └── page.tsx              → /book-session
│   │
│   ├── (auth)/                       ← SHARED: Auth flows (Supabase)
│   │   ├── layout.tsx                ← Minimal centered layout
│   │   ├── login/
│   │   │   └── page.tsx              → /login
│   │   └── magic-link/
│   │       └── page.tsx              → /magic-link (email link landing)
│   │
│   ├── cms/                          ← PRIVATE: Marketing CMS (renamed from admin/)
│   │   ├── login/
│   │   │   └── page.tsx              → /cms/login
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       ├── page.tsx              → /cms
│   │       ├── blog/
│   │       ├── branches/
│   │       ├── gallery/
│   │       ├── bookings/
│   │       ├── faq/
│   │       ├── homepage/
│   │       ├── learning-journey/
│   │       ├── partners/
│   │       ├── projects/
│   │       ├── reviews/
│   │       ├── site-media/
│   │       └── students/
│   │
│   ├── admin/                        ← PRIVATE: LMS Super Admin portal
│   │   ├── layout.tsx                ← Super Admin shell
│   │   ├── page.tsx                  → /admin
│   │   ├── branches/                 → /admin/branches
│   │   ├── users/                    → /admin/users
│   │   ├── roles/                    → /admin/roles
│   │   ├── audit-logs/               → /admin/audit-logs
│   │   ├── analytics/                → /admin/analytics
│   │   └── settings/                 → /admin/settings
│   │
│   ├── branch/                       ← PRIVATE: Team Leader / Branch Manager
│   │   ├── layout.tsx
│   │   ├── page.tsx                  → /branch
│   │   ├── students/
│   │   ├── instructors/
│   │   ├── groups/
│   │   ├── courses/
│   │   ├── schedule/
│   │   ├── attendance/
│   │   ├── financials/
│   │   └── reports/
│   │
│   ├── instructor/                   ← PRIVATE: Instructor portal
│   │   ├── layout.tsx
│   │   ├── page.tsx                  → /instructor
│   │   ├── groups/
│   │   ├── attendance/
│   │   ├── grading/
│   │   ├── courses/
│   │   └── schedule/
│   │
│   ├── student/                      ← PRIVATE: Student portal
│   │   ├── layout.tsx
│   │   ├── page.tsx                  → /student
│   │   ├── courses/
│   │   │   └── [courseId]/
│   │   │       └── [lessonId]/
│   │   ├── assignments/
│   │   ├── attendance/
│   │   ├── schedule/
│   │   └── progress/
│   │
│   ├── parent/                       ← PRIVATE: Parent portal
│   │   ├── layout.tsx
│   │   ├── page.tsx                  → /parent
│   │   ├── [childId]/                ← per-child sub-section
│   │   │   ├── attendance/
│   │   │   ├── progress/
│   │   │   ├── schedule/
│   │   │   ├── grades/
│   │   │   └── payments/
│   │   └── messages/
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts          ← Supabase OAuth callback
│   │   ├── cms/                      ← CMS API (moved from api/admin/)
│   │   │   ├── blog/
│   │   │   ├── branches/
│   │   │   └── ...
│   │   ├── webhooks/
│   │   │   └── supabase/
│   │   │       └── route.ts          ← DB webhooks (notifications, etc.)
│   │   └── search/
│   │       └── route.ts              ← Global search endpoint
│   │
│   ├── globals.css
│   ├── layout.tsx                    ← Root layout: fonts, providers only
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── robots.ts
│   └── sitemap.ts
│
├── components/
│   │
│   ├── marketing/                    ← Marketing website components only
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   ├── sections/                 ← Homepage and page sections
│   │   │   ├── AccreditationsSection.tsx
│   │   │   ├── BranchesSection.tsx
│   │   │   ├── CompetitionsSection.tsx
│   │   │   ├── ContactSection.tsx
│   │   │   ├── FAQSection.tsx
│   │   │   ├── FeaturedStudentsSection.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── HomeSections.tsx
│   │   │   ├── LearningJourneySection.tsx
│   │   │   ├── PartnersSection.tsx
│   │   │   ├── ProgramsSection.tsx
│   │   │   ├── ProjectsSection.tsx
│   │   │   ├── ReviewsSection.tsx
│   │   │   ├── TrustSection.tsx
│   │   │   └── WhySection.tsx
│   │   └── forms/
│   │       └── TrialForm.tsx
│   │
│   ├── cms/                          ← Marketing CMS components
│   │   ├── CmsShell.tsx              (renamed from AdminShell.tsx)
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── StatCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── EmptyStateCard.tsx
│   │   ├── CharacterLimitHint.tsx
│   │   ├── MediaPreviewCard.tsx
│   │   ├── MediaRequirementsBadge.tsx
│   │   ├── MediaValidationMessage.tsx
│   │   └── UploadGuidelinesCard.tsx
│   │
│   ├── platform/                     ← LMS portal shared components
│   │   ├── shell/                    ← Per-role layout shells
│   │   │   ├── AdminShell.tsx        (LMS admin, not CMS)
│   │   │   ├── BranchShell.tsx
│   │   │   ├── InstructorShell.tsx
│   │   │   ├── StudentShell.tsx
│   │   │   └── ParentShell.tsx
│   │   ├── attendance/
│   │   ├── courses/
│   │   ├── grades/
│   │   ├── progress/
│   │   ├── schedule/
│   │   ├── notifications/
│   │   └── search/
│   │
│   └── ui/                           ← Primitive components (shared everywhere)
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       ├── Card.tsx
│       ├── Table.tsx
│       ├── Modal.tsx
│       ├── Select.tsx
│       ├── LogoRail.tsx
│       ├── SectionEmptyState.tsx
│       ├── SectionTitle.tsx
│       └── Reveal.tsx
│
├── modules/                          ← Domain feature modules (business logic)
│   │                                   Rule: NO React imports allowed here
│   │                                   Contains: actions, queries, types, schemas
│   │
│   ├── auth/
│   │   ├── actions.ts                ← Server Actions: signIn, signOut, refreshSession
│   │   ├── queries.ts                ← getSession, getUser, getUserWithProfile
│   │   ├── schemas.ts                ← Zod: LoginSchema, etc.
│   │   └── types.ts
│   │
│   ├── rbac/
│   │   ├── permissions.ts            ← All permission constants (PERMISSIONS object)
│   │   ├── roles.ts                  ← Role definitions and role-permission map
│   │   ├── resolver.ts               ← hasPermission(), getUserPermissions()
│   │   ├── guards.ts                 ← requirePermission() (throws on fail)
│   │   └── types.ts                  ← Permission, Role, UserRole types
│   │
│   ├── users/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── students/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── instructors/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── parents/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── branches/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── groups/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── courses/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   ├── types.ts
│   │   ├── modules/                  ← course_modules sub-domain
│   │   │   ├── actions.ts
│   │   │   └── queries.ts
│   │   └── lessons/                  ← lessons sub-domain
│   │       ├── actions.ts
│   │       └── queries.ts
│   │
│   ├── attendance/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── assignments/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   ├── types.ts
│   │   └── submissions/
│   │       ├── actions.ts
│   │       └── queries.ts
│   │
│   ├── schedule/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   │
│   ├── progress/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   └── types.ts
│   │
│   ├── notifications/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── dispatcher.ts             ← Routes notifications to channels
│   │   └── types.ts
│   │
│   ├── announcements/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   └── types.ts
│   │
│   ├── financials/
│   │   ├── invoices/
│   │   │   ├── actions.ts
│   │   │   └── queries.ts
│   │   ├── payments/
│   │   │   ├── actions.ts
│   │   │   └── queries.ts
│   │   ├── subscriptions/            ← Future: recurring billing
│   │   │   └── types.ts
│   │   ├── discounts/                ← Future: coupons + discounts
│   │   │   └── types.ts
│   │   └── types.ts
│   │
│   ├── media/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   └── types.ts
│   │
│   ├── videos/                       ← External video metadata (Google Drive etc.)
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   └── types.ts
│   │
│   ├── search/
│   │   ├── engine.ts                 ← Search logic: multi-entity query
│   │   ├── queries.ts
│   │   └── types.ts
│   │
│   ├── analytics/
│   │   ├── events.ts                 ← trackEvent() utility
│   │   ├── queries.ts
│   │   └── types.ts
│   │
│   └── ai/                           ← Future AI module (placeholder)
│       └── types.ts
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 ← Browser Supabase client (existing)
│   │   ├── server.ts                 ← Server Supabase client (existing)
│   │   └── service.ts                ← Service role client (NEW — server-only)
│   ├── db/
│   │   ├── index.ts                  ← Shared DB helpers
│   │   └── errors.ts                 ← DB error handling utilities
│   ├── i18n.ts                       ← (existing, unchanged)
│   ├── analytics.ts                  ← (existing, unchanged)
│   └── utils.ts                      ← General utilities
│
├── types/
│   ├── database.ts                   ← AUTO-GENERATED by supabase gen types
│   ├── app.ts                        ← App-level composite types
│   └── enums.ts                      ← Shared enums (status values, etc.)
│
├── schemas/                          ← Shared Zod schemas (cross-module)
│   ├── common.ts                     ← UUID, pagination, date range
│   └── search.ts
│
├── contexts/
│   └── LanguageContext.tsx           ← (existing, unchanged)
│
├── middleware.ts                     ← Next.js route middleware (auth + RBAC)
│
├── supabase/
│   ├── config.toml
│   ├── migrations/                   ← Ordered SQL migration files
│   │   ├── 0001_init_auth.sql
│   │   ├── 0002_rbac.sql
│   │   ├── 0003_organization.sql
│   │   ├── 0004_people.sql
│   │   ├── 0005_academic.sql
│   │   ├── 0006_curriculum.sql
│   │   ├── 0007_schedule_attendance.sql
│   │   ├── 0008_assessments.sql
│   │   ├── 0009_financials.sql
│   │   ├── 0010_media_videos.sql
│   │   ├── 0011_notifications.sql
│   │   ├── 0012_analytics.sql
│   │   ├── 0013_audit.sql
│   │   ├── 0014_search_indexes.sql
│   │   └── 0015_rls_policies.sql
│   └── seed/
│       ├── 001_roles.sql
│       └── 002_permissions.sql
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROJECT-STRUCTURE.md          ← This file
│   └── PHASE-0.md
│
├── public/
├── messages/                         ← i18n translation files (existing)
├── CLAUDE.md
├── AGENTS.md
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Module Boundaries

### The Iron Rule

```
modules/    ← Business logic. Zero React imports. Zero Next.js imports.
            ← Only: TypeScript, Zod, Supabase client calls, Server Actions.

components/ ← UI only. May import from modules/ for types.
            ← Never put DB queries or Server Actions directly inside components.

app/        ← Routing only. Pages are thin: import from modules/ + components/.
            ← Data fetching happens via Server Actions or Server Components
               calling modules/*/queries.ts directly.
```

### Dependency Flow

```
app/pages
    │
    ├── imports → components/platform/*     (UI)
    │               └── imports → components/ui/*   (primitives)
    │
    └── calls  → modules/*/actions.ts       (Server Actions)
                    └── calls → lib/supabase/server.ts  (DB)
                    └── calls → modules/rbac/resolver.ts (permissions)
```

### Forbidden Dependencies

| From | May NOT import |
|---|---|
| `modules/*` | `components/*`, `app/*`, `next/*`, `react` |
| `components/ui/*` | `modules/*` (only types allowed) |
| `lib/supabase/service.ts` | Must never be imported in any client component |
| `middleware.ts` | Must never import from `modules/*` (use edge-compatible code only) |

---

## 5. Portal Architecture

### URL Space and Access Control

| Portal | URL Prefix | Required Role | Auth |
|---|---|---|---|
| Marketing | `/`, `/blog`, `/book-session` | None | Public |
| Auth flows | `/login`, `/magic-link` | None | Public |
| CMS | `/cms` | password cookie | Cookie check |
| LMS Super Admin | `/admin` | `super_admin` | Supabase JWT |
| LMS Branch Mgmt | `/branch` | `team_leader` | Supabase JWT |
| LMS Instructor | `/instructor` | `instructor` | Supabase JWT |
| LMS Student | `/student` | `student` | Supabase JWT |
| LMS Parent | `/parent` | `parent` | Supabase JWT |

### Portal Layout Isolation

Each LMS portal has its own layout file (`app/[portal]/layout.tsx`). Layouts:
- Validate the user's role for the portal
- Load the user's branch assignment
- Render the portal shell component
- Inject the notification context
- Inject RBAC context (user's resolved permissions)

### Role Redirect Map

When a user logs in, middleware determines which portal to send them to based on their primary role:

```
super_admin  → /admin
team_leader  → /branch
instructor   → /instructor
student      → /student
parent       → /parent
```

If a user has multiple roles (e.g., a team leader who is also an instructor), they default to their highest-privilege role but can switch contexts.

---

## 6. CMS Architecture

### What CMS Is

The **CMS** (`/cms`) is an **internal content management tool** for the marketing website. It is NOT the LMS admin panel. It manages:
- Blog posts
- Branch listings on the marketing site
- Gallery
- Reviews, partners, accreditations
- FAQ
- Site media

### CMS Auth Model (Preserved)

The CMS continues to use the current password cookie approach. It is a single-user internal tool and does not need Supabase Auth. This auth remains completely independent of the LMS auth system.

```
CMS Auth:   admin_session cookie ← password match ← ADMIN_PASSWORD env var
LMS Auth:   Supabase JWT ← Supabase Auth ← RBAC claims
```

These two systems share zero auth infrastructure.

### CMS Migration Path

| Current | Target | Change |
|---|---|---|
| `app/admin/` | `app/cms/` | Rename directory |
| `app/api/admin/` | `app/api/cms/` | Rename + update fetch paths |
| `components/admin/` | `components/cms/` | Rename + update imports |
| `app/admin/login/` | `app/cms/login/` | Rename |

No functional changes — only path renames.

---

## 7. API Organization Strategy

### Principle: Minimize API Routes

With Next.js 16 Server Actions, most mutations should NOT go through API routes. The pattern:

```
✓ Server Action in modules/*/actions.ts  → called directly from components
✗ POST /api/students → Server Action inside an API route
```

### When to Use API Routes

| Use Case | Route |
|---|---|
| Supabase Auth OAuth callback | `api/auth/callback/route.ts` |
| Supabase DB webhooks | `api/webhooks/supabase/route.ts` |
| CMS CRUD (existing, keep) | `api/cms/[resource]/route.ts` |
| Global search | `api/search/route.ts` |
| External webhook receivers | `api/webhooks/[provider]/route.ts` |
| File upload presigned URLs | `api/media/upload/route.ts` |

### CMS API Routes (Transition)

Existing `/api/admin/*` routes are renamed to `/api/cms/*`. All `fetch('/api/admin/...')` calls in CMS pages are updated to `fetch('/api/cms/...')`.

### LMS Operations via Server Actions (not API routes)

```typescript
// modules/students/actions.ts
'use server'
export async function createStudent(data: CreateStudentInput) {
  const user = await requirePermission('manage_students')
  // DB operation
}
```

---

## 8. Auth & Session Architecture

### Two Parallel Auth Systems

```
┌─────────────────────────────────────────────────────┐
│  SYSTEM 1: CMS Auth (Simple)                        │
│  Cookie: admin_session = ADMIN_PASSWORD hash        │
│  Protected routes: /cms, /api/cms                   │
│  Checked in: middleware.ts (fast path)              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SYSTEM 2: LMS Auth (Supabase)                      │
│  Cookie: sb-[ref]-auth-token (Supabase managed)     │
│  Protected routes: /admin, /branch, /instructor,    │
│                    /student, /parent                 │
│  Checked in: middleware.ts + layout.tsx guards      │
│  Claims: role, branch_ids, permissions[]            │
└─────────────────────────────────────────────────────┘
```

### Supabase Auth Setup Requirements

1. **Auth Hooks** — Supabase `auth.users` hook to inject custom claims:
   ```sql
   -- Called on every token refresh
   -- Injects: global_role, branch_ids, permissions[]
   ```

2. **JWT Custom Claims** shape:
   ```json
   {
     "app_metadata": {
       "global_role": "instructor",
       "branch_ids": ["uuid1"],
       "permissions": ["manage_attendance", "grade_assignments"]
     }
   }
   ```

3. **Session refresh** on every navigation (middleware handles this via `supabase.auth.getUser()`)

### `lib/supabase/` Client Hierarchy

| File | When Used | Auth Level |
|---|---|---|
| `client.ts` | Client components, browser | User session |
| `server.ts` | Server components, Server Actions, middleware | User session |
| `service.ts` | Server Actions with admin bypass, Edge Functions | Service role |

`service.ts` must NEVER be imported from:
- Any client component
- Any component file
- `middleware.ts`

Only from `modules/*/actions.ts` (Server Actions) and Edge Functions.

---

## 9. RBAC Middleware Placement

### Middleware Responsibilities (`middleware.ts`)

```
Request → middleware.ts
  │
  ├── Is it a static asset or Next.js internal? → passthrough
  │
  ├── Is it a CMS route (/cms)?
  │     └── Has valid admin_session cookie? → allow | redirect /cms/login
  │
  ├── Is it an LMS portal route (/admin, /branch, /instructor, /student, /parent)?
  │     ├── Has valid Supabase session? → continue
  │     │     └── Does role match portal?
  │     │           ├── Yes → allow
  │     │           └── No → redirect to correct portal OR /login
  │     └── No session → redirect to /login?next=[current-url]
  │
  └── Public route → passthrough
```

### What Middleware Does NOT Do

Middleware runs on the Edge Runtime. It must stay lightweight:

- **Does NOT** check granular permissions (e.g., `manage_students`) — that's in Server Actions
- **Does NOT** query the database — only reads JWT claims
- **Does NOT** import from `modules/*` — edge runtime incompatible
- **Does NOT** render anything — just redirects or allows

Granular permission checks live in `modules/rbac/guards.ts` and are called from Server Actions.

### RBAC Depth

```
Layer 1 — Middleware:     "Is this user logged in? Do they have the right role for this portal?"
Layer 2 — Layout:         "Does this user have access to this section? (branch assignment check)"
Layer 3 — Server Action:  "Does this user have the specific permission for this operation?"
Layer 4 — Database RLS:   "Does this row belong to the user's allowed branch/scope?"
```

Never rely on only one layer. All four must hold.

---

## 10. Server Actions Strategy

### Location Rule

Server Actions live in `modules/[domain]/actions.ts`, not in component files or `app/` pages.

```typescript
// modules/attendance/actions.ts
'use server'

import { requirePermission } from '@/modules/rbac/guards'
import { createServerClient } from '@/lib/supabase/server'
import { RecordAttendanceSchema } from './schemas'

export async function recordAttendance(data: unknown) {
  const validated = RecordAttendanceSchema.parse(data)
  const user = await requirePermission('manage_attendance', { branchId: validated.branchId })
  
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('attendance_records')
    .insert({ ...validated, recorded_by: user.id })

  if (error) throw new Error(error.message)
}
```

### Action File Conventions

```typescript
// Every actions.ts file follows this pattern:
'use server'

// 1. Permission check first (always)
// 2. Input validation via Zod schema
// 3. DB operation
// 4. Audit log emit
// 5. Return data or throw typed error
```

### No Raw Supabase in Components

```typescript
// ❌ FORBIDDEN in any component:
const { data } = await supabase.from('students').select('*')

// ✓ CORRECT: call a Server Action or use a server component query
import { getStudentsByBranch } from '@/modules/students/queries'
const students = await getStudentsByBranch(branchId)
```

---

## 11. Data Access Layer

### `modules/*/queries.ts` — Read Queries

Server Component-only read functions. Called directly from Server Components (not through API routes).

```typescript
// modules/students/queries.ts
import { createServerClient } from '@/lib/supabase/server'

export async function getStudentsByBranch(branchId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, profiles(first_name, last_name), status, enrollment_date')
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}
```

### `modules/*/actions.ts` — Write Mutations

Server Actions only. Always permission-check first.

### `types/database.ts` — Generated Types

Never manually written. Regenerated with:
```bash
npx supabase gen types typescript --local > types/database.ts
```

All queries are typed against `Database['public']['Tables']`.

---

## 12. Naming Conventions

### Files

| Type | Convention | Example |
|---|---|---|
| React component | PascalCase | `StudentCard.tsx` |
| Server Action file | camelCase | `actions.ts` |
| Query file | camelCase | `queries.ts` |
| Schema file | camelCase | `schemas.ts` |
| Type file | camelCase | `types.ts` |
| Utility | camelCase | `utils.ts` |
| SQL migration | `NNNN_description.sql` | `0001_init_auth.sql` |
| API route | `route.ts` | `route.ts` |

### Database (all English, snake_case)

```
Tables:     snake_case       → students, group_students, attendance_records
Columns:    snake_case       → first_name, branch_id, created_at
Enums:      snake_case       → user_role, attendance_status
Functions:  snake_case       → user_has_permission, get_student_progress
Indexes:    idx_[table]_[col] → idx_students_branch_id
Policies:   descriptive      → "students_branch_isolation"
```

### TypeScript

```typescript
// Interfaces: PascalCase
interface StudentProfile { ... }

// Type aliases: PascalCase
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'makeup'

// Enums: PascalCase with PascalCase members
enum BranchType { Online = 'online', Offline = 'offline', Hybrid = 'hybrid' }

// Constants: SCREAMING_SNAKE
const PERMISSIONS = { MANAGE_STUDENTS: 'manage_students' } as const

// Zod schemas: PascalCase + Schema suffix
const CreateStudentSchema = z.object({ ... })
```

### Portal URL Naming

```
/student/courses          ← plural resources
/student/courses/[id]     ← singular resource by ID
/student/courses/[id]/lessons/[lessonId]  ← nested resource
/branch/students/[id]/attendance  ← resource action
```

---

## 13. Scalability Safeguards

### Feature Flags Preparation

Add a `feature_flags` table from day one:
```
feature_flags: id, name, enabled_for (JSONB: branches/users/all), created_at
```

New LMS features ship behind flags. Enables safe rollouts per branch.

### Multi-Tenancy Ceiling

The current design (single org, multiple branches) should later support multiple organizations (multi-tenant SaaS). Prepare by:
- Always having `org_id` on branches
- Never hardcoding the org_id
- Keeping `organizations` table even if only one row exists today

### Module Independence

Each `modules/[domain]/` is designed to be independently testable. No cross-module imports in actions.ts files (only via shared `lib/`). If two domains need to communicate, they do so via:
1. Shared DB queries (both reading same tables)
2. Shared event emission (analytics_events)
3. Explicit service calls (one module calls another's queries, never actions)

### Internationalization

- All DB data stored in English
- Frontend uses existing `messages/` i18n system
- No Arabic text hardcoded in components — always via translation keys
- RTL layout handled via `LanguageContext` direction

---

## 14. Migration Strategy from Current Structure

### Phase: CMS Migration (do this FIRST before any LMS work)

This is purely a rename. Zero functional changes. The goal is to free up `/admin` for the LMS Super Admin portal.

**Step 1 — Create new CMS route**
```
app/cms/ ← new directory
  login/page.tsx      (copy from app/admin/login/page.tsx)
  (dashboard)/
    layout.tsx        (copy from app/admin/(dashboard)/layout.tsx)
    page.tsx + all sub-pages
```

**Step 2 — Redirect old admin routes**
```
app/admin/ ← temporarily add redirect:
  page.tsx → redirect('/cms')
```

**Step 3 — Update API paths**
```
app/api/cms/ ← copy all files from app/api/admin/
Update all fetch('/api/admin/...') in CMS pages to fetch('/api/cms/...')
```

**Step 4 — Move CMS components**
```
components/cms/ ← move from components/admin/
Update all imports
```

**Step 5 — Remove old admin routes**
```
Delete app/admin/ (after CMS routes confirmed working)
Delete app/api/admin/ (after API routes confirmed working)
Delete components/admin/
```

**Step 6 — Update middleware.ts**
```
Add: /cms → admin_session cookie check
Add: /admin → Supabase JWT check (super_admin role)
```

### Phase: Marketing Components Reorganization

Move flat `components/*.tsx` → `components/marketing/`:

```
Hero.tsx               → components/marketing/sections/Hero.tsx
Navbar.tsx             → components/marketing/layout/Navbar.tsx
Footer.tsx             → components/marketing/layout/Footer.tsx
HomeSections.tsx       → components/marketing/sections/HomeSections.tsx
AccreditationsSection  → components/marketing/sections/AccreditationsSection.tsx
BranchesSection        → components/marketing/sections/BranchesSection.tsx
... (all other sections)
TrialForm.tsx          → components/marketing/forms/TrialForm.tsx
Reveal.tsx             → components/ui/Reveal.tsx (shared animation)
```

Update all imports in `app/` pages.

### Phase: LMS Skeleton Creation (Phase 0)

Create empty portal shells with minimal placeholder content (no business UI yet):
```
app/admin/layout.tsx + page.tsx
app/branch/layout.tsx + page.tsx
app/instructor/layout.tsx + page.tsx
app/student/layout.tsx + page.tsx
app/parent/layout.tsx + page.tsx
```

---

## 15. File-by-File Migration Map

| Current Path | Target Path | Action |
|---|---|---|
| `app/admin/login/page.tsx` | `app/cms/login/page.tsx` | Move |
| `app/admin/(dashboard)/layout.tsx` | `app/cms/(dashboard)/layout.tsx` | Move |
| `app/admin/(dashboard)/page.tsx` | `app/cms/(dashboard)/page.tsx` | Move |
| `app/admin/(dashboard)/blog/page.tsx` | `app/cms/(dashboard)/blog/page.tsx` | Move |
| `app/admin/(dashboard)/branches/page.tsx` | `app/cms/(dashboard)/branches/page.tsx` | Move |
| *(all other CMS pages)* | `app/cms/(dashboard)/*/page.tsx` | Move |
| `app/api/admin/login/route.ts` | `app/api/cms/login/route.ts` | Move |
| `app/api/admin/logout/route.ts` | `app/api/cms/logout/route.ts` | Move |
| `app/api/admin/blog/route.ts` | `app/api/cms/blog/route.ts` | Move |
| *(all other CMS API routes)* | `app/api/cms/*/route.ts` | Move |
| `components/admin/AdminShell.tsx` | `components/cms/CmsShell.tsx` | Move + Rename |
| `components/admin/Sidebar.tsx` | `components/cms/Sidebar.tsx` | Move |
| `components/admin/Topbar.tsx` | `components/cms/Topbar.tsx` | Move |
| *(all other admin components)* | `components/cms/*.tsx` | Move |
| `components/Hero.tsx` | `components/marketing/sections/Hero.tsx` | Move |
| `components/Navbar.tsx` | `components/marketing/layout/Navbar.tsx` | Move |
| `components/Footer.tsx` | `components/marketing/layout/Footer.tsx` | Move |
| `components/Reveal.tsx` | `components/ui/Reveal.tsx` | Move |
| `components/TrialForm.tsx` | `components/marketing/forms/TrialForm.tsx` | Move |
| *(all other section components)* | `components/marketing/sections/*.tsx` | Move |
| `lib/supabase/client.ts` | `lib/supabase/client.ts` | Keep |
| `lib/supabase/server.ts` | `lib/supabase/server.ts` | Keep |
| — | `lib/supabase/service.ts` | NEW |
| `lib/analytics.ts` | `lib/analytics.ts` | Keep |
| `lib/i18n.ts` | `lib/i18n.ts` | Keep |
| `contexts/LanguageContext.tsx` | `contexts/LanguageContext.tsx` | Keep |
| — | `middleware.ts` | NEW |
| — | `modules/` | NEW |
| — | `types/` | NEW |
| — | `schemas/` | NEW |
| — | `supabase/migrations/` | NEW |

---

*End of Project Structure Plan*  
*Next: Execute CMS migration, then create Phase 0 skeleton*
