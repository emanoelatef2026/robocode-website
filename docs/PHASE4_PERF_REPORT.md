# Phase 4 — تحسين أداء قاعدة البيانات — تقرير الإنجاز

**تاريخ:** 2026-07-06
**المصدر:** `LMS_FULL_REVIEW_2026-07-05.md` §5، Supabase project `fkqwafedruparlqjiprq`
**الحالة:** مكتمل — 5 migrations منفصلة، كل واحدة اتفحصت بـ `npx vitest run` قبل وبعد.

## المقارنة قبل / بعد

| الفئة | قبل | بعد | الفرق |
|---|---|---|---|
| `duplicate_index` | 8 | **0** | ✅ اتحل بالكامل |
| `auth_rls_initplan` | 160 | **0** | ✅ اتحل بالكامل (156 auth.uid()/auth.jwt() + 4 auth.role()) |
| `multiple_permissive_policies` | 321 | 179 | -142 (الجداول الساخنة المذكورة في الخطة) |
| `unindexed_foreign_keys` | 100 | 79 | -21 (الجداول المطلوبة فقط) |
| `unused_index` | 155 | 173 | +18 (فهارس migration 4 الجديدة + صافي حذف الفهارس المكررة) |
| `no_primary_key` | 1 | 1 | خارج نطاق هذه المرحلة |
| **الإجمالي** | 744 | 432 | **-312 (-42%)** |

> ملاحظة عن ارتفاع `unused_index`: الفهارس اللي اتضافت في migration 4 للـ FKs
> (21 فهرس) لسه صفر استخدام لحد ما traffic حقيقي يلمسها — ده متوقع وطبيعي،
> مش تراجع. انظر `docs/UNUSED_INDEXES.md` للتفاصيل والقرار المؤجل.

## الـ Migrations المطبّقة (بالترتيب)

1. **`phase4_drop_duplicate_indexes`** — مسح 7 فهارس مكررة (attendance_records ×3
   شامل unique constraint، blog_posts، finance_payments، student_enrollments ×2،
   student_financial_accounts). اتأكدنا قبلها إن مفيش FK بيعتمد على أي من الـ
   unique constraints المتنافسة، وإن الكود بيستخدم onConflict بالأعمدة مش
   باسم الـ constraint.
2. **`phase4_rls_wrap_auth_functions`** — تغليف `auth.uid()`/`auth.jwt()` بـ
   `(select ...)` في 156 policy، اتولّدت أوتوماتيك من `pg_policies` بسكريبت
   Node.js وعُرضت كاملة قبل التطبيق.
3. **`phase4_rls_wrap_auth_role`** — نفس الإصلاح لـ 4 policies كانت بتستخدم
   `auth.role()` بدل `auth.uid()`/`auth.jwt()` (اكتُشفت بعد المقارنة الأولى).
4. **`phase4_merge_permissive_policies_batch1`** — دمج السياسات المتعددة في
   `attendance_records`, `finance_installments`, `finance_payments`, `groups`,
   `schedules`, `student_enrollments`, `students`. كل policy من نوع `ALL` اتقسمت
   لـ INSERT/UPDATE/DELETE منفصلة (بنفس الشرط)، والسياسات المتعددة على SELECT
   اتدمجت في policy واحدة بـ OR — نفس السلوك بالظبط، بس policy واحدة لكل action.
5. **`phase4_merge_permissive_policies_batch2`** — نفس النمط لـ
   `certificate_templates`, `portfolio_projects`, `session_feedback`,
   `student_portfolios`, `student_projects`, `submissions`.
6. **`phase4_index_unindexed_foreign_keys`** — فهارس لـ 21 FK في الجداول
   الفعّالة: `student_enrollments` (5), `student_timeline_events` (4),
   `attendance_records` (2), `collection_activities` (2), `finance_notes` (2),
   `certificates` (3), `finance_payment_reversals` (3).

## اللي اتأجل (بقرار واعي)

- **`multiple_permissive_policies` الباقية (179)**: خارج الجداول الساخنة
  المذكورة في الخطة (مثلاً certificate_templates له سياسات تانية غير اللي
  اتذكرت، وجداول تانية غير مذكورة في القائمة الأصلية). محتاجة جولة تانية لو
  اتقرر nemo.
- **`unindexed_foreign_keys` الباقية (79)**: جداول فاضية أو نادرة الاستخدام
  زي `invoices`, `payments`, `instructor_payouts` — مؤجلة زي ما اتفقنا.
- **`unused_index` (173)**: قرار المسح مؤجل بالكامل لحد ما يبقى عندنا traffic
  إنتاج حقيقي — التفاصيل في `docs/UNUSED_INDEXES.md`.
- **`no_primary_key` (1)**: جدول واحد من غير primary key — لم يكن ضمن نطاق هذه
  المرحلة، يحتاج فحص منفصل.

## التحقق

- `npx vitest run` نُفّذ بعد كل migration على حدة — **244/244 اختبار ناجح** في
  كل مرة، بدون أي تراجع.
- كل الـ migrations دي schema-only (DDL على indexes/policies) — مفيش أي
  تعديل بيانات.
