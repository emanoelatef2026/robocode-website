# تقرير الفهارس غير المستخدمة — Phase 4

**تاريخ:** 2026-07-06
**المصدر:** `pg_stat_user_indexes` (idx_scan = 0)، بعد تطبيق migrations 1-4 من Phase 4.
**الإجمالي:** 173 فهرس غير مستخدم — بحجم كلي **2416 kB (~2.4 MB)**.

## القرار: لا يوجد مسح تلقائي الآن

الداتابيز لسه صغيرة (كل فهرس هنا في أصغر حجم ممكن للـ btree، 8-64 kB) و`idx_scan`
لسه مش عبّر عن نمط استخدام حقيقي (مفيش traffic كفاية على الإنتاج عشان نثق في
الإحصائيات). مسح فهرس دلوقتي ممكن يبوّظ query لسه ما اتعملتلوش scan لأن حجم
الجدول صغير أصلاً (الـ planner بيفضّل seq scan على أي حال).

**التوصية العامة:** أعد فحص هذه القائمة بعد 4-8 أسابيع من traffic حقيقي على
الإنتاج، وبس الوقتها امسح اللي لسه idx_scan = 0.

## مجموعات حسب الحجم والسبب

### 1. فهارس اتضافت في Phase 4 نفسها (متوقع idx_scan=0 مؤقتاً)
دي الفهارس اللي اتضافت في migration 4 (unindexed FKs) — طبيعي إنها صفر لسه
لحد ما query تستخدمها. **متتمسحش أبداً** من غير ما نتأكد إنها مش هتتستخدم:

| الجدول | الفهرس |
|---|---|
| student_enrollments | idx_student_enrollments_created_by, idx_student_enrollments_group_student_id, idx_student_enrollments_instructor_id, idx_student_enrollments_transferred_from, idx_student_enrollments_transferred_to |
| student_timeline_events | idx_student_timeline_events_actor_user_id, idx_student_timeline_events_branch_id, idx_student_timeline_events_enrollment_id, idx_student_timeline_events_student_id |
| attendance_records | idx_attendance_records_makeup_schedule_id, idx_attendance_records_recorded_by |
| collection_activities | idx_collection_activities_account_id, idx_collection_activities_created_by |
| finance_notes | idx_finance_notes_account_id, idx_finance_notes_created_by |
| certificates | idx_certificates_issued_by, idx_certificates_revoked_by, idx_certificates_template_id |
| finance_payment_reversals | idx_fpr_account_id, idx_fpr_created_by, idx_fpr_original_payment_id |

### 2. فهارس بحث نصي (trgm) — غالباً ميزة بحث لسه مش مستخدمة بكثافة
`idx_profiles_name_trgm` (64 kB), `idx_courses_title_trgm` (24 kB),
`idx_groups_name_trgm` (32 kB), `idx_lessons_title_trgm` (16 kB),
`idx_announcements_title_trgm` (16 kB)
**توصية:** سيبها — لو فيه شاشة بحث (autocomplete/fuzzy search) بتعتمد عليها،
هتظهر مستخدمة أول ما حد يجرب البحث فعلياً في الإنتاج.

### 3. audit_logs (4 فهارس، أكبرهم في القائمة كلها)
`idx_audit_logs_action` (64 kB), `idx_audit_logs_branch` (64 kB),
`idx_audit_logs_entity` (56 kB), `idx_audit_logs_created_at` (48 kB)
**توصية:** شاشة الـ audit log نادراً ما بتتفتح (admin only) — طبيعي إنها صفر
استخدام حالياً. سيبها لحد ما نتأكد إن شاشة الـ audit فعلاً مربوطة وبتستخدم فلترة.

### 4. الباقي (16 kB أو 8 kB لكل واحد) — 150+ فهرس
معظمهم فهارس FK/status/filter على جداول صغيرة (leads, finance_payments,
student_enrollments, certificates, courses, semesters, invoices, payments,
assignments, submissions, ...إلخ). كلهم في أصغر حجم ممكن، فمفيش أي مكسب
مساحة حقيقي من مسحهم دلوقتي. القرار بتاعهم بيتأجل لحد ما يبقى عندنا شهرين+
من بيانات استخدام حقيقية من الإنتاج.

## خطوة المتابعة

بعد 4-8 أسابيع من الإنتاج الفعلي، شغّل:

```sql
select s.relname, s.indexrelname, pg_size_pretty(pg_relation_size(s.indexrelid)) as size, s.idx_scan
from pg_stat_user_indexes s
join pg_index i on i.indexrelid = s.indexrelid
where s.schemaname='public' and s.idx_scan = 0 and not i.indisprimary and not i.indisunique
order by pg_relation_size(s.indexrelid) desc;
```

وامسح بس اللي لسه idx_scan = 0 **وملوش** foreign key عليه بيتحاج له منطقياً
(زي الفهارس اللي اتضافت في migration 4 أعلاه — سيبها لحد ما نشوف نمط استخدام
حقيقي أطول).
