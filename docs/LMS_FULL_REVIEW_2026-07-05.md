# تقرير المراجعة الشاملة — Robocode LMS
**التاريخ:** 2026-07-05 | **الفرع:** main | **قاعدة البيانات:** robocode-platform (Supabase, Postgres 17)

---

## 1. الملخص التنفيذي

| المحور | الحالة | الأرقام |
|--------|--------|---------|
| TypeScript | ✅ سليم | 0 أخطاء |
| الاختبارات | ⚠️ | 5 فاشلة من 236 (3 ملفات) |
| أمان قاعدة البيانات | 🔴 حرج | 59 خطأ ERROR + 116 تحذير (206 lint إجمالاً) |
| سلامة البيانات | 🔴 حرج | أقساط فاسدة (3,400 قسط لحساب واحد) + 506 حضور بدون ledger |
| أداء قاعدة البيانات | 🟠 | 744 ملاحظة (سياسات مكررة، فهارس مكررة/غير مستخدمة) |
| نظافة الكود | 🟠 | 6 modules ميتة، صفحات legacy، ملفات عملاقة 2,000+ سطر |
| الـ Migrations | 🟠 | مجلدين منفصلين + drift بين الملفات المحلية والمطبّق فعلياً |

**أخطر 3 حاجات لازم تتصلح فوراً:**
1. **12 جدول من غير RLS خالص** — أي حد معاه الـ anon key (وهو public في الـ JS bundle) يقدر يقرأ ويكتب فيهم، ومنهم `trial_bookings` (فيه أسماء وتليفونات عملاء).
2. **28 دالة SECURITY DEFINER قابلة للتنفيذ بالـ anon role** — منها `award_xp`، `repair_student_portal_accounts`، `full_recompute_all_consumption`، `cancel_schedule_with_cascade`. يعني أي حد من غير تسجيل دخول يقدر يعدّل بيانات النظام.
3. **بيانات الأقساط فاسدة** — 3,507 قسط كلهم PENDING، منهم 3,400 على حساب **واحد**، و2,517 تاريخ استحقاقهم بعد سنة 2100 (لحد 2309-09-09). ده bug في مولّد الأقساط عمل runaway loop.

---

## 2. الأمان (Security) — 🔴 أولوية قصوى

### 2.1 جداول بدون RLS ومكشوفة بالـ API (ERROR ×12)
`trial_bookings` (وعليه policies بس الـ RLS نفسه مقفول!)، `gallery`، `subscription_plans`، `installment_plans`، `announcement_reads`، `analytics_events_default`، `ai_interactions`، `session_instructors`، `notification_reads`، `trial_session_students`، `makeup_session_students`، `welcome_message_logs`.

- `sensitive_columns_exposed`: الـ linter علّم `analytics_events_default` و `session_instructors` كجداول بتسرّب أعمدة حساسة.
- **ملاحظة مهمة:** التطبيق كله شغال بالـ service-role client (186 ملف)، فالـ RLS مش هيكسر حاجة في التطبيق لو اتفعّل — بس **لازم** يتفعّل عشان يقفل الـ REST API المكشوف.

**العلاج:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` على الـ 12 جدول + policy واحدة على الأقل لكل جدول (مثلاً service_role فقط، و`trial_bookings` يفضل INSERT-only للـ anon عشان فورم الحجز العام).

### 2.2 دوال SECURITY DEFINER مفتوحة (WARN ×28 anon + ×28 authenticated)
دوال إدارية خطيرة متاحة للتنفيذ عبر RPC لأي حد:
`award_xp`, `cancel_schedule_with_cascade`, `consume_attendance_sessions_batch`, `full_recompute_all_consumption`, `increment_consumed_sessions_batch`, `reconcile_*` (7 دوال), `refresh_grade_summary`, `refresh_student_progress`, `remove_student_consumption`, `repair_student_portal_accounts`, `write_audit_log`... إلخ.

**العلاج:** `REVOKE EXECUTE ON FUNCTION ... FROM anon, authenticated;` — التطبيق بيناديها بالـ service role فمش هيتأثر. (دوال الـ triggers زي `trg_*` و`handle_new_auth_user` تتسحب برضه — الـ triggers بتشتغل بصلاحيات صاحب الجدول مش المستدعي).

### 2.3 SECURITY DEFINER Views (ERROR ×44)
كل الـ views التشغيلية (`v_dashboard_overview`, `v_student_risk`, `v_operations_alerts`, `search_index`, وكل `v_*` تقريباً) معمولة SECURITY DEFINER — يعني بتتخطى RLS لأي حد يقدر يعمل SELECT منها.

**العلاج:** `ALTER VIEW ... SET (security_invoker = true);` أو `REVOKE SELECT FROM anon, authenticated` لو الوصول ليها من السيرفر بس.

### 2.4 باقي ملاحظات الأمان
| المشكلة | العدد | العلاج |
|---------|------|--------|
| `function_search_path_mutable` | 55 دالة | `ALTER FUNCTION ... SET search_path = ''` (يتعمل بسكريبت واحد) |
| RLS مفعّل بدون أي policy | 30 جدول | سلوكه Deny-all — مش ثغرة، بس يستحسن policies صريحة |
| `rls_policy_always_true` | 2 (`session_payments.sp_super_admin`, `student_parent_contacts.service_full_access`) | مراجعة الشرط |
| Leaked password protection مقفول | 1 | تفعيله من Auth settings |
| خيارات MFA قليلة | 1 | تفعيل TOTP على الأقل |
| `pg_trgm` في الـ public schema | 1 | نقله لـ extensions schema |
| Public bucket `portfolio-images` بيسمح بالـ listing | 1 | تضييق سياسة الـ SELECT |

---

## 3. سلامة البيانات (Data Integrity) — 🔴 حرج

### 3.1 كارثة الأقساط (finance_installments)
- **3,507 قسط، كلهم status = PENDING** (ولا قسط واحد paid/overdue).
- **حساب واحد عليه 3,400 قسط** (المتوسط الطبيعي للباقي ~1).
- **2,517 قسط تاريخ استحقاقهم بعد سنة 2100** — لحد 2309-09-09.
- **65 قسط فات معاد استحقاقهم ولسه PENDING** — يعني دالة `mark_overdue_installments` موجودة بس **مفيش cron بيشغلها**.

**المطلوب:**
1. تحديد مصدر الـ runaway loop في كود توليد الأقساط (غالباً في enrollment/payment-plan flow) وإصلاحه.
2. سكريبت تنظيف يمسح الأقساط الوهمية للحساب المتضرر ويعيد توليدها صح.
3. جدولة `mark_overdue_installments()` عبر pg_cron يومياً.
4. مراجعة migration `0060_installment_status_sync` — واضح إن الـ sync مش شغال (0 أقساط اتعلّمت paid رغم وجود 112 دفعة).

### 3.2 نظام استهلاك الحصص (attendance_consumptions) شبه معطّل
- 526 سجل حضور مقابل **20 سجل استهلاك بس** — **506 حضور بدون ledger entry** (`v_consumption_integrity` → MISSING).
- ده معناه إن `consumed_sessions` و `remaining_sessions` في `student_enrollments` مش بيعكسوا الحضور الفعلي لأغلب الطلبة.
- دوال reconciliation موجودة جاهزة (`reconcile_all_unmatched_sql`, `recompute_session_consumption`...) بس محدش شغّلها.

**المطلوب:** تشغيل reconciliation (dry-run الأول)، والتحقق إن الـ trigger اللي بيعمل consumption عند تسجيل الحضور شغال على المسار الحالي.

### 3.3 باقي فحوصات الـ integrity views
| الفحص | العدد | التقييم |
|-------|------|---------|
| `v_orphan_sessions` (حصص برقم بدون instructor allocation) | 42 | يحتاج allocation backfill |
| `v_group_count_drift` OPEN_ENDED (مجموعات بدون total_sessions) | 6 | مراجعة تعاقدات المجموعات |
| طلبة بدون حساب مالي (`student_financial_accounts`) | **64 من 173** | إنشاء حسابات (فيه دالة repair جاهزة) |
| `v_contract_consumption_mismatch` | 5 | يتصلح مع الـ reconciliation |
| `v_student_contract_drift` / `v_attendance_drift` | 5 / 5 | يتصلح مع الـ reconciliation |
| `v_enrollment_integrity` / `v_sessions_without_number` | 0 ✅ | سليم |

### 3.4 جدول deprecated لسه موجود
`student_certificates` معلّم DEPRECATED من migration 0024 ولسه موجود — يتأكد إنه فاضي ويتمسح.

---

## 4. الـ Migrations — 🟠 فوضى تنظيمية

### 4.1 مجلدين منفصلين
- `supabase/migrations/` — 133 ملف مرقّم (0001→0127 + timestamped) — ده المصدر الرسمي.
- `migrations/` (في الروت) — 17 ملف sprint32→46 اتشغلوا **يدوياً في SQL Editor** من غير أي تتبع (جداول leads، student_enrollments، finance كلها جت من هنا).

### 4.2 Drift بين المحلي والمطبّق
- ملفات محلية بأسماء مرقمة (0114→0127) مطبّقة على الداتابيز بأسماء timestamps مختلفة — `supabase db push` هيتلخبط.
- `0118_financial_expenses_v2.sql` موجود محلياً ومش ظاهر في سجل الـ migrations المطبقة.
- `20260702093000_instructor_payout_requests` + `20260702142545_drop_...` (اتعمل واتشال) موجودين محلياً ومش في السجل، وملفات مطبّقة بversions مش موجودة محلياً (`20260702100930`, `20260702101548`, `20260705072242`).
- مفيش ملف `0059` أصلاً (فجوة في الترقيم).

**المطلوب:** جلسة توحيد واحدة — `supabase migration repair` لمزامنة السجل، نقل ملفات `migrations/` القديمة لأرشيف `docs/legacy-migrations/`، واعتماد `supabase/migrations/` بالـ timestamps كمصدر وحيد من هنا ورايح.

---

## 5. أداء قاعدة البيانات — 🟠 (744 ملاحظة)

| الفئة | العدد | التأثير | العلاج |
|-------|------|---------|--------|
| `multiple_permissive_policies` | 321 | كل query بيقيّم سياسات مكررة (أسوأها `certificate_templates` و`student_projects` ×24) | دمج السياسات المتعددة لكل action/role في policy واحدة |
| `auth_rls_initplan` | 160 | `auth.uid()` بيتنفذ لكل صف | تغليفه بـ `(SELECT auth.uid())` |
| `unused_index` | 156 | مساحة + إبطاء writes | مراجعة ومسح بعد التأكد |
| `unindexed_foreign_keys` | 99 | JOINs بطيئة (أهمها `student_enrollments` ×5، `student_timeline_events` ×4) | إضافة فهارس للـ FKs المستخدمة في queries فعلاً |
| `duplicate_index` | 8 | مساحة مهدرة | مسح فوري — قائمة جاهزة: `attendance_records` ×3، `student_enrollments` ×2، `blog_posts`، `finance_payments`، `student_financial_accounts` |

> ملاحظة: طالما التطبيق service-role، بنود RLS performance تأثيرها محدود حالياً — بس هتبقى مهمة أول ما RLS يتفعّل بجد.

---

## 6. الكود — التكرارات والتنظيف 🟠

### 6.1 Modules ميتة (صفر استخدام خارجي) — تتمسح أو تتوثّق
| Module | ملاحظة |
|--------|--------|
| `modules/financials/` | 10 ملفات / 24 سطر — هيكل فاضي، اتلغى لصالح `finance` |
| `modules/notification-engine/` | 154 سطر — مفيش أي import |
| `modules/videos/`, `modules/media/`, `modules/announcements/`, `modules/ai/` | هياكل شبه فاضية بدون استخدام |

وفيه modules استخدامها هامشي (1–2 import) تستحق مراجعة دمج: `messages`, `consistency`, `benchmarks`, `predictive-engine`, `tasks`.

### 6.2 ازدواج الواجهات: `/admin` مقابل `/portal/team-leader`
نفس الدومينات متكررة في السطحين (students, groups, instructors, parents, leads, certificates, courses, analytics, finance, payroll, special-sessions). الصفحات الجديدة نسبياً بتشارك الـ client component (زي `admin/students` بيستورد `StudentsClient` بتاع TL — كويس)، لكن فيه شاشات مالية **مستقلة بالكامل**:
- `admin/finance` + `admin/finance-center` (1,729 سطر) + `admin/payroll` + `admin/revenue` + `admin/expenses`
- مقابل TL: `finance` + `collections` + `payroll` (2,120 سطر) + `instructor-payroll`

**القرار المطلوب:** تحديد السطح الرسمي لكل دومين مالي وتحويل التاني لـ thin wrapper أو مسحه.

### 6.3 صفحات legacy كان مفروض تتشال (بنص SPRINT_61_HANDOFF)
- `app/portal/team-leader/instructors/[id]/page.tsx` + `[id]/edit/` — الـ workspace الجديد حل محلهم.
- صفحات مش موصولة بأي sidebar (orphans تتراجع وتتمسح أو تتوصّل): admin → `communications`, `revenue`, `expenses`, `recovery`, `semesters`, `sessions`, `system-events`, `portfolio` | TL → `attendance`, `assignments`, `collections`, `instructor-payroll`, `instructor-performance`, `parent-feedback`, `parent-satisfaction`, `portfolio`.

### 6.4 ملفات عملاقة محتاجة تفكيك
| الملف | الأسطر |
|-------|--------|
| `app/portal/team-leader/payroll/FinanceClient.tsx` | 2,120 |
| `app/admin/finance-center/FinancialManagementClient.tsx` | 1,729 |
| `app/portal/team-leader/finance/EnrollmentWizard.tsx` | 1,233 |
| `app/portal/team-leader/groups/GroupFormModal.tsx` | 1,223 |
| `app/portal/team-leader/groups/GroupDetailDrawer.tsx` | 1,222 |
| + 5 ملفات تانية فوق 900 سطر | |

### 6.5 Helpers متكررة
- منطق واتساب (`wa.me` links) متكرر يدوياً في **20+ ملف** → helper واحد `lib/whatsapp.ts`.
- `getStatusColor`/status maps معرّفة **12 مرة** → توحيد في `lib/status.ts` أو `modules/shared`.
- `formatDate` معرّفة 3 مرات.

### 6.6 قمامة في روت المشروع
- `تحسين تصميم نظام LMS.zip` + مجلدين `LMS design` و `LMS Design files` — يتنقلوا خارج الريبو أو لـ `docs/design/`.
- `HANDOFF.md` (سبرينت 46) قديم ومضلل مقارنة بـ `SPRINT_61_HANDOFF.md` — يتأرشف.

---

## 7. الاختبارات — ⚠️

- **5 فاشلة من 236** في 3 ملفات:
  - `tests/progress/wiring.test.ts` — 3 (الـ progress recalc مش بيتنده كالمتوقع بعد الحضور/التسجيل)
  - `tests/analytics/queries.test.ts` — 1 (`resolveGroupFilter` للـ instructor)
  - `tests/special-sessions/special-sessions.test.ts` — 1 (`endTrialSession` مش بيعلّم TRIAL_ATTENDED)
- فشل `wiring` مقلق بالذات لأنه مرتبط بنفس منطقة خلل الـ consumption (بند 3.2) — ممكن يكون نفس الجذر.
- مفيش CI ظاهر بيشغل الاختبارات (يتأكد ويضاف GitHub Actions).

---

## 8. خطة العمل المقترحة (Sequence)

### المرحلة 1 — إغلاق الثغرات الأمنية (يوم–يومين) 🔴
1. Migration واحد: تفعيل RLS على الـ 12 جدول + policies أساسية (service_role فقط + INSERT للـ anon على `trial_bookings`).
2. `REVOKE EXECUTE` على الـ 28 دالة من anon/authenticated.
3. تحويل الـ 44 view لـ `security_invoker = true` (أو REVOKE SELECT).
4. سكريبت `SET search_path = ''` للـ 55 دالة.
5. تفعيل leaked-password protection + TOTP من الداشبورد.
6. **اختبار املأ-الفراغات:** تجربة فورم حجز التجربة + تسجيل دخول كل الأدوار بعد التطبيق.

### المرحلة 2 — إصلاح البيانات المالية والحضور (2–4 أيام) 🔴
1. تشخيص bug مولّد الأقساط (الحساب صاحب الـ 3,400 قسط) وإصلاح الكود.
2. سكريبت تنظيف الأقساط الفاسدة (backup الأول) + إصلاح sync حالات paid.
3. جدولة `mark_overdue_installments` بـ pg_cron.
4. Dry-run لدوال reconciliation بتاعة الـ consumption ثم التطبيق (506 سجل).
5. إنشاء الحسابات المالية للـ 64 طالب.
6. معالجة الـ 42 orphan session (allocation backfill).
7. إصلاح الاختبارات الـ 5 الفاشلة (غالباً مرتبطة بنفس المنطقة).

### المرحلة 3 — توحيد الـ Migrations (نصف يوم) 🟠
1. `supabase migration repair` لمزامنة السجل مع الملفات.
2. أرشفة مجلد `migrations/` القديم.
3. اعتماد convention واحد (timestamps) من هنا ورايح.

### المرحلة 4 — أداء قاعدة البيانات (يوم–يومين) 🟠
1. مسح الـ 8 فهارس المكررة (قائمة جاهزة في بند 5).
2. دمج الـ multiple permissive policies (يبدأ بالجداول الساخنة: attendance, enrollments, finance).
3. `(SELECT auth.uid())` في الـ 160 policy.
4. فهارس للـ FKs الساخنة + مراجعة الـ 156 فهرس غير المستخدم.

### المرحلة 5 — تنظيف الكود (2–3 أيام) 🟡
1. مسح الـ 6 modules الميتة + صفحات instructor الـ legacy + الـ orphan pages (بعد تأكيد).
2. حسم ازدواجية admin/TL في الشاشات المالية.
3. توحيد helpers الواتساب والـ status colors.
4. تفكيك `FinanceClient.tsx` (2,120 سطر) و`FinancialManagementClient.tsx` (1,729 سطر).
5. تنظيف روت المشروع (zip + مجلدات التصميم) وأرشفة `HANDOFF.md` القديم.

### المرحلة 6 — الحوكمة المستمرة 🟢
1. CI: tsc + vitest + eslint على كل PR.
2. تشغيل `get_advisors` بعد كل migration.
3. Cron مراقبة أسبوعي على integrity views مع تنبيه لو الأرقام زادت.
4. حذف جدول `student_certificates` الـ deprecated بعد التأكد إنه فاضي.

---

## ملاحظات ختامية
- الكود structurally سليم (0 TS errors، معمارية modules واضحة، الصفحات الجديدة بتشارك components صح) — المشكلة الأساسية **تراكم طبقات سبرينتات قديمة** ما اتنضفتش، و**فجوة كاملة في أمان طبقة الداتابيز** لأن الاعتماد كله على service-role.
- ترتيب الأولوية مبني على الخطورة: تسريب بيانات العملاء (مرحلة 1) قبل صحة الأرقام المالية (مرحلة 2) قبل أي تحسينات.
