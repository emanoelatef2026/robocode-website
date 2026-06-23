# Claude Code Prompt — RoboCode LMS Design Redesign
## Team Leader & Super Admin Pages

---

## 🎯 المهمة

تطبيق نفس التصميم الجديد اللي اتعمل على صفحات الطالب (Student Portal) على **كل صفحات Team Leader والـ Super Admin** في المشروع.

التصميم المرجعي موجود في:
- `Student Attendance.dc.html` — صفحة مرجعية كاملة للطالب
- `Student Dashboard Final.dc.html` — داشبورد الطالب
- `Design Reference — RoboCode LMS.dc.html` — مرجع التوكنات والكومبوننتس

---

## 🎨 Design Tokens (الثوابت)

### Colors
```css
/* Brand */
--navy:         #0B1F3A   /* sidebar bg, page titles, dark text */
--navy-light:   #163560   /* dark card variant */
--orange:       #FF8A1F   /* primary accent, active nav, CTAs */
--orange-soft:  #FFB15A   /* XP bars, soft orange */

/* Surfaces */
--bg:           #F8FAFC   /* page background */
--card-bg:      #FFFFFF
--border:       #E2E8F0   /* card borders, dividers */
--border-inner: #e7ebf1   /* inner card dividers */

/* Typography */
--text:         #0F172A   /* body text */
--text-2:       #334155
--muted:        #64748B   /* subtitles, labels */
--muted-light:  #94A3B8   /* placeholder, secondary info */

/* Status */
--green:        #10B981   /* present / success */
--green-bg:     #D1FAE5
--green-text:   #15803D
--amber:        #F59E0B   /* late / warning */
--amber-bg:     #FEF3C7
--amber-text:   #92400E
--red:          #EF4444   /* absent / error */
--red-bg:       #FEE2E2
--red-text:     #991B1B
--blue:         #38BDF8   /* info / excused */
--blue-bg:      #E0F2FE
--blue-text:    #0369A1
```

### Fonts
```
Poppins       → كل الـ UI text (EN)
Cairo         → Arabic text
Orbitron      → الأرقام الكبيرة في KPI cards، والـ brand wordmark
JetBrains Mono → كود أو ID values (اختياري)
```

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Orbitron:wght@500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

في `layout.tsx` الـ root أو `globals.css` أضف الـ import لو مش موجود.

---

## 🏗️ Shell Components

### 1. `components/admin/AdminShell.tsx`
لا تغير هيكله — هو صح. بس تأكد:
- `bg-[#F8FAFC]` على الـ wrapper ✅ (موجود)
- الـ main overflow-y-auto ✅ (موجود)

### 2. `components/admin/AdminSidebar.tsx`
التصميم الحالي قريب جداً من المطلوب. الـ changes:

**Logo section** — ارتفاع الـ logo strip يبقى `h-16` (64px) وليس `h-14`:
```tsx
// قبل
<div className="flex h-14 shrink-0 items-center border-b border-white/8 px-5">
// بعد
<div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-5">
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
    <Image src="/logo.png" alt="Robocode" width={24} height={24} className="h-6 w-6 object-contain" />
  </div>
  <span className="font-['Orbitron'] text-[12px] font-700 tracking-[.04em] text-white">ROBOCODE</span>
</div>
```

**Active nav item** — تأكد إن الـ active state هو:
```tsx
// active
"bg-[#FF8A1F]/15 text-[#FF8A1F]"
// inactive
"text-white/50 hover:bg-white/5 hover:text-white/80"
```
✅ هذا موجود بالفعل — لا تغيير مطلوب.

**User footer** — أضف avatar circle مع initials لو مش موجود:
```tsx
<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#38BDF8] to-[#0B1F3A] text-[11px] font-bold text-white">
  {initials}
</div>
```

### 3. `components/admin/AdminTopbar.tsx`
اعمل redesign كامل للـ topbar:

```tsx
// المطلوب:
<header className="flex h-16 shrink-0 items-center gap-4 border-b border-[#E2E8F0] bg-white px-4 md:px-7">
  {/* Hamburger — mobile only */}
  <button onClick={onMenuClick} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] md:hidden">
    {/* hamburger icon */}
  </button>

  {/* Page title — يجي من الـ pathname */}
  <div>
    <h1 className="text-[17px] font-extrabold text-[#0B1F3A]">{pageTitle}</h1>
    <p className="text-[11px] text-[#64748B]">{formattedDate} · {roleLabel}</p>
  </div>

  <div className="flex-1" />

  {/* Search — desktop only */}
  <div className="hidden items-center gap-2 rounded-[10px] border border-[#e4e9f0] bg-[#F1F5F9] px-3 py-2 md:flex w-48">
    {/* search icon */}
    <span className="text-[12px] text-[#94A3B8]">Search…</span>
  </div>

  {/* Branch badge */}
  <div className="hidden items-center gap-2 rounded-[10px] border border-[#e4e9f0] bg-white px-3 py-2 md:flex">
    <span className="h-2 w-2 rounded-full bg-[#FF8A1F]" />
    <span className="text-[12px] font-semibold text-[#0B1F3A]">{branchName}</span>
  </div>

  {/* Notification bell */}
  <button className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#e4e9f0] bg-white">
    {/* bell icon */}
    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#DC2626] ring-2 ring-white" />
  </button>
</header>
```

**لاحظ:** الـ topbar لازم يعرف الـ pageTitle من الـ pathname. استخدم `usePathname()` وعمل map من path لـ title.

---

## 📄 Page Content Styles

### PageHeader Component (`components/admin/PageHeader.tsx`)
ده الكومبوننت اللي بيظهر عنوان الصفحة. غيّره:

```tsx
export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-[20px] font-extrabold text-[#0B1F3A]">{title}</h1>
        {subtitle && <p className="mt-1 text-[12px] text-[#64748B]">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
```

### KPI / Stat Cards

كل KPI card في صفحات الـ admin والـ TL لازم تتبع واحد من النمطين دول:

**Pattern A — Icon + Big Number + Badge** (للحضور والطلاب):
```tsx
<div className="flex items-center gap-3.5 rounded-2xl border border-[#e7ebf1] bg-white p-4">
  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] bg-[{iconBg}] text-2xl">
    {emoji}
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-[10.5px] font-semibold text-[#64748B]">{label}</p>
    <p className="font-['Orbitron'] text-[26px] font-bold leading-none text-[#0B1F3A] mt-1">{value}</p>
  </div>
  <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold bg-[{tagBg}] text-[{tagFg}]">
    {tag}
  </span>
</div>
```

**Pattern B — Label + Number + Delta + Mini bars** (للـ Super Admin analytics):
```tsx
<div className="rounded-[15px] border border-[#e7ebf1] bg-white p-4">
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-semibold text-[#64748B]">{label}</span>
    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-[{deltaBg}] text-[{deltaFg}]">{delta}</span>
  </div>
  <div className="mt-2.5 flex items-end justify-between">
    <span className="font-['Orbitron'] text-[28px] font-bold leading-none text-[#0B1F3A]">{value}</span>
    {/* mini bar chart — 7 bars */}
  </div>
</div>
```

### Section Labels (بدل الـ Tailwind utility classes في `Section` component):
```tsx
function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#94A3B8]">{title}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#CBD5E1]">{sub}</p>}
    </div>
  )
}
```

### Alert / Warning Rows (بدل الـ `Alert` component):
```tsx
function Alert({ icon, label, count, href, level = 'warning' }) {
  if (count === 0) return null
  const styles = {
    critical: { border: 'border-red-200',   bg: 'bg-red-50',   text: 'text-red-700'   },
    warning:  { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
    info:     { border: 'border-blue-200',  bg: 'bg-blue-50',  text: 'text-blue-700'  },
  }[level]
  return (
    <Link href={href}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:brightness-95 ${styles.border} ${styles.bg} ${styles.text}`}>
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      <span className="font-['Orbitron'] text-[14px] font-bold">{count}</span>
      {/* chevron → */}
    </Link>
  )
}
```

### Status Badges (`components/admin/StatusBadge.tsx`):
```tsx
const statusConfig = {
  active:    { bg: 'bg-[#D1FAE5]', text: 'text-[#15803D]', label: 'Active'   },
  inactive:  { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', label: 'Inactive' },
  present:   { bg: 'bg-[#D1FAE5]', text: 'text-[#15803D]', label: 'Present'  },
  late:      { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', label: 'Late'     },
  absent:    { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]', label: 'Absent'   },
  excused:   { bg: 'bg-[#E0F2FE]', text: 'text-[#0369A1]', label: 'Excused'  },
  pending:   { bg: 'bg-[#FFF1E2]', text: 'text-[#FF8A1F]', label: 'Pending'  },
  converted: { bg: 'bg-[#D1FAE5]', text: 'text-[#15803D]', label: 'Converted'},
  lost:      { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]', label: 'Lost'     },
}

export default function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const c = statusConfig[status] ?? statusConfig.inactive
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
```

### Data Tables:
كل table في الـ app لازم تتبع الـ pattern ده:

```tsx
// Table wrapper
<div className="overflow-hidden rounded-[18px] border border-[#e7ebf1] bg-white">
  {/* Table header */}
  <div className="border-b border-[#e7ebf1] bg-[#F8FAFC] px-5 py-3">
    <div className="grid grid-cols-{N} gap-4">
      <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#94A3B8]">Column</span>
    </div>
  </div>
  {/* Rows */}
  {items.map(item => (
    <div key={item.id} className="grid grid-cols-{N} items-center gap-4 border-t border-[#f1f4f8] px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
      {/* cells */}
    </div>
  ))}
</div>
```

### Cards (generic):
```tsx
<div className="rounded-[18px] border border-[#e7ebf1] bg-white p-5">
  {/* card header */}
  <div className="mb-4 flex items-center justify-between">
    <h3 className="text-[14px] font-bold text-[#0B1F3A]">{title}</h3>
    <button className="text-[11.5px] font-semibold text-[#FF8A1F]">View all</button>
  </div>
  {/* content */}
</div>
```

### Progress Bars:
```tsx
<div className="h-[7px] overflow-hidden rounded-full bg-[#eef1f6]">
  <div
    className="h-full rounded-full transition-all"
    style={{ width: `${pct}%`, background: pct >= 90 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444' }}
  />
</div>
```

---

## 📁 الملفات اللي محتاج تعدّلها

### Shell (مشترك بين TL والـ Super Admin)
| File | Change |
|------|--------|
| `components/admin/AdminTopbar.tsx` | Redesign كامل حسب المواصفات فوق |
| `components/admin/AdminSidebar.tsx` | Logo strip → h-16 + logo icon + wordmark |
| `components/admin/AdminShell.tsx` | لا تغيير — صح كما هو |
| `components/admin/PageHeader.tsx` | تحديث typography |
| `components/admin/StatusBadge.tsx` | تطبيق color system جديد |
| `app/globals.css` | إضافة Orbitron font import |

### Super Admin Pages (`app/admin/`)
| File | ما يتغير |
|------|---------|
| `app/admin/page.tsx` | كل الـ `Card` و `Alert` و `Section` components تتطبق عليها الـ patterns الجديدة |
| `app/admin/students/page.tsx` | Table redesign + StatusBadge |
| `app/admin/groups/page.tsx` | Table redesign + health progress bars |
| `app/admin/groups/[id]/GroupDetailView.tsx` | Cards + KPIs |
| `app/admin/groups/[id]/GroupStudentsTable.tsx` | Table redesign |
| `app/admin/instructors/page.tsx` | Table redesign |
| `app/admin/attendance/page.tsx` | KPI cards + status badges |
| `app/admin/finance/page.tsx` | Finance KPI cards (Pattern B) |
| `app/admin/finance/FinanceClient.tsx` | Cards + progress bars |
| `app/admin/leads/page.tsx` | Table + status badges |
| `app/admin/analytics/page.tsx` | KPI cards Pattern B |
| `app/admin/branches/page.tsx` | Cards |
| `app/admin/system-health/page.tsx` | Alert rows redesign |
| `app/admin/revenue/page.tsx` | Finance KPIs |
| `app/admin/payroll/page.tsx` | Table + KPIs |
| `app/admin/courses/page.tsx` | Table redesign |
| `app/admin/certificates/page.tsx` | Table + badges |
| `app/admin/assignments/page.tsx` | Table redesign |
| `app/admin/sessions/page.tsx` | Table + status |

### Team Leader Pages (`app/instructor/`)
> **ملاحظة:** Team Leader يستخدم نفس AdminShell ونفس Sidebar لكن يظهر فقط الـ nav items اللي عنده permission عليها. لا تحتاج shell منفصل.

| File | ما يتغير |
|------|---------|
| `app/instructor/attendance/page.tsx` | KPI cards Pattern A + calendar heatmap |
| `app/instructor/groups/page.tsx` | Group health cards + progress bars |
| `app/instructor/courses/page.tsx` | Course cards |
| `app/instructor/schedule/page.tsx` | Schedule cards |
| `app/instructor/grading/page.tsx` | Table + grading badges |

---

## 🔑 قواعد مهمة

### 1. الـ Orbitron font للأرقام فقط
كل رقم كبير في KPI card يستخدم `font-['Orbitron']` أو class `font-orbitron` لو عرفّته في config:
```tsx
// Tailwind config
fontFamily: {
  orbitron: ['Orbitron', 'sans-serif'],
}
```
```tsx
// استخدام
<span className="font-orbitron text-[28px] font-bold">{value}</span>
```

### 2. Active nav = Orange glow
```tsx
// Active sidebar item
className="bg-[#FF8A1F]/15 text-[#FF8A1F]"
// Active dot
<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" />
```

### 3. Card border consistency
- كل card: `border border-[#e7ebf1] rounded-2xl` (18px) للكارت الكبيرة
- KPI cards: `border border-[#e7ebf1] rounded-xl` (16px)
- Row items / alerts: `rounded-xl` (12px)
- لا تستخدم `shadow-md` أو أكبر — بس `border` بدون shadow أو shadow خفيف جداً

### 4. Alert cards — border يتغير لو alert
```tsx
// Normal card
"border-[#e7ebf1]"
// Alert card (error)
"border-red-200 bg-red-50"
// Alert card (warning)
"border-amber-200 bg-amber-50"
```

### 5. Responsive
- Desktop (md+): sidebar ظاهر، topbar فيه search وبيانات
- Mobile: sidebar مخفي، bottom nav أو hamburger
- الـ grid في الـ KPIs: `grid-cols-2 md:grid-cols-4`

### 6. لا تمس الـ Business Logic
فقط غيّر الـ UI/CSS — الـ data fetching والـ Supabase queries والـ server actions تبقى كما هي.

### 7. الـ Tailwind classes بدل inline styles
المشروع يستخدم Tailwind — استخدمه بدل `style={{}}` إلا في الحالات الديناميكية (width %، generated colors).

---

## ✅ Acceptance Criteria

بعد الانتهاء، كل صفحة لازم:
- [ ] Topbar: أبيض، h-16، title + date، search، branch badge، notification bell
- [ ] Sidebar: Navy #0B1F3A، active item برتقالي، logo صح
- [ ] KPI Cards: Orbitron numbers، rounded-2xl، border #e7ebf1
- [ ] Status badges: color system محدد (green/amber/red/blue)
- [ ] Alert rows: color-coded borders
- [ ] Tables: header بـ uppercase tracking، rows بـ border-[#f1f4f8]، hover:bg-[#F8FAFC]
- [ ] Progress bars: color-coded by percentage
- [ ] لا يوجد Tailwind classes عشوائية تخالف الـ tokens
- [ ] الصفحة responsive على mobile

---

## 📸 المرجع البصري

راجع هذه الملفات في المشروع للمرجع البصري الكامل:
- `Student Attendance.dc.html` — مرجع كامل للـ Student pages
- `Design Reference — RoboCode LMS.dc.html` — كل التوكنات والكومبوننتس مرسومة
- `Student Dashboard Final.dc.html` — داشبورد الطالب كمرجع

---

*Generated by RoboCode Design System — June 2025*
