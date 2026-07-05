# Handoff — Sprint 46 + Migration Status

## الوضع الحالي

Sprint 46 (Operations Center Finalization) **اتعمل كامل في الكود**.
المشكلة الوحيدة المتبقية: تشغيل المايجريشنز في Supabase SQL Editor.

---

## المايجريشنز — الحالة

| الملف | الحالة |
|-------|--------|
| sprint41_enrollment_centric.sql | ✅ اتشغل (بعد التصليح) |
| sprint42_enrollment_snapshots.sql | ✅ اتشغل (بعد التصليح) |
| sprint43_operations_hardening.sql | ✅ اتشغل (بعد التصليح) |
| sprint44_session_contract.sql | ⏳ لسه مش اتشغل |
| sprint45_operational_finance_finalization.sql | ⏳ لسه مش اتشغل |
| sprint46_operations_center_finalization.sql | ⏳ لسه مش اتشغل |

---

## أخطاء اتصلحت في المايجريشنز

### 1. `gs.created_at` و `gs.notes` مش موجودين في `group_students`
**في sprint41** — الـ INSERT كان بيرفر لـ columns مش موجودة.
**الحل:** استبدلناهم بـ `now()` وحذفنا `notes`.

### 2. `user_branch_assignments` مش موجود
قاعدة البيانات دي بتخزن الـ `branch_id` في `user_roles.branch_id` مباشرةً.
**الحل في كل RLS policy:**
```sql
-- ❌ غلط
JOIN public.user_branch_assignments uba ON uba.user_id = ur.user_id
AND uba.branch_id = table.branch_id

-- ✅ صح
WHERE ur.user_id = auth.uid()
  AND r.name = 'team_leader'
  AND ur.branch_id = table.branch_id
```

### 3. `JOIN` على الجدول المستهدف في `UPDATE`
**في sprint42** — PostgreSQL مش بيسمح تعمل reference للجدول المُحدَّث في الـ `JOIN`.
**الحل:** استبدلنا `JOIN` بـ comma في `FROM` وحطينا الشرط في `WHERE`.
```sql
-- ❌ غلط
FROM public.branches b
JOIN public.groups g ON g.id = se.group_id

-- ✅ صح
FROM public.branches b, public.groups g
WHERE b.id = se.branch_id AND g.id = se.group_id
```

---

## ما اتعمل في Sprint 46 (الكود)

### ملفات اتغيرت
| الملف | التغيير |
|-------|---------|
| `modules/finance/types.ts` | إضافة `enrollment_id` لـ `AddActivityInput`, `AddNoteInput`, `AddPromiseInput` |
| `modules/finance/queries.ts` | إضافة `getFilterOptions()` — تحميل branches/groups/instructors من DB مستقل |
| `modules/finance/actions.ts` | حفظ `enrollment_id` في `recordActivity`, `addFinanceNote`, `addPaymentPromise` |
| `app/portal/team-leader/finance/page.tsx` | استخدام `getFilterOptions()` بدل بناء الفلاتر من الـ rows |
| `app/portal/team-leader/finance/StudentOpsTable.tsx` | debounced search + branches prop + null display + Needs Action badge + priority sort |
| `app/portal/team-leader/finance/StudentOpsDrawer.tsx` | live payment preview + enrollment_id في actions + fix fetchDetail refresh bug |
| `app/api/student-ops/[studentId]/route.ts` | payments تتجيب بـ enrollment_id OR account_id (مش account_id بس) |
| `migrations/sprint46_operations_center_finalization.sql` | enrollment_id على collection_activities/finance_notes/payment_promises |

### المشاكل اللي اتصلحت
1. **فلاتر Groups/Instructors فاضية** → `getFilterOptions()` بتحملهم من DB مباشرةً
2. **"No payments recorded yet"** → API دلوقتي بيجيب payments بـ enrollment_id OR account_id
3. **Drawer مش بيتحدث بعد الدفع** → صلحنا stale closure bug في `fetchDetail`
4. **مفيش طريقة واضحة للدفع** → بتنة الدفع واضحة + live preview للمبلغ المتبقي
5. **Null display** → "No package" / "Unassigned" / "0%" بدل شرطة
6. **Sort** → BLOCKED → OVERDUE → CRITICAL → absences → low attendance
7. **"Needs Action" column** → Collect Now / Renew Package / Attendance Risk / Missing Payment

---

## الخطوات الجاية

### 1. شغّل sprint44
انسخ المحتوى من `migrations/sprint44_session_contract.sql` في Supabase SQL Editor.
> **ملاحظة:** الملف فيه RLS policy لـ `finance_payment_reversals` — تم التصليح مسبقاً باستخدام `ur.branch_id` بدل `user_branch_assignments`.

### 2. شغّل sprint45
انسخ المحتوى من `migrations/sprint45_operational_finance_finalization.sql`.
مفيهوش RLS policies — المفروض يشتغل بدون مشاكل.

### 3. شغّل sprint46
انسخ المحتوى من `migrations/sprint46_operations_center_finalization.sql`.

### 4. تحقق من الشغل
بعد ما تشغل الـ 3 مايجريشنز، ارجع لـ:
`http://localhost:3000/portal/team-leader/finance`

وجرب تعمل Enroll لطالب — المفروض يشتغل دلوقتي.

---

## معلومات تقنية مهمة

### Schema الـ RBAC
- Branch IDs مخزنة في `user_roles.branch_id` مباشرةً
- مفيش جدول `user_branch_assignments`
- الكود في `modules/rbac/resolver.ts` بيعمل `SELECT branch_id FROM user_roles WHERE user_id = userId`

### الـ student_enrollments table
- بتتعمل في sprint41
- بيتم backfill من `group_students` تلقائياً
- كل طالب في group = row واحدة في `student_enrollments`
- الـ `remaining_sessions` = generated column = `enrolled_sessions - consumed_sessions`

### Payment Flow
```
addPayment() / quickPayment()
  → INSERT finance_payments (account_id + enrollment_id)
  → trigger: recompute_account_balance()
  → trigger: sync_enrollment_financial_status()
  → revalidatePath()
  → Drawer refreshes
```

---

## Working Directory
`d:\Robocode\robocode-new`

## Git Branch
`main`
