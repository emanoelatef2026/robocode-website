-- ══════════════════════════════════════════════════════════════════════════════
-- Data fix 2026-07-06: align students.branch_id with their group's branch.
-- Root cause: student creation form defaulted every student to one branch
-- (5th Setlement) while their groups live in the correct branches.
-- All changed rows are preserved in _backup_student_branch_fix_20260706.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Backup table (old + new values, restorable)
create table if not exists _backup_student_branch_fix_20260706 (
  student_id    uuid primary key,
  old_branch_id uuid,
  new_branch_id uuid,
  source        text,
  created_at    timestamptz not null default now()
);

-- 2. Record every student whose branch will change
with target as (
  -- students with an active membership: primary group first, earliest joined
  select distinct on (gs.student_id)
    gs.student_id, g.branch_id as new_branch, 'active_group' as source
  from group_students gs
  join groups g on g.id = gs.group_id
  where gs.status = 'active' and g.deleted_at is null
  order by gs.student_id, (gs.enrollment_type = 'primary') desc, gs.joined_at
),
fallback as (
  -- students with no active membership: most recent past group
  select distinct on (gs.student_id)
    gs.student_id, g.branch_id as new_branch, 'last_group' as source
  from group_students gs
  join groups g on g.id = gs.group_id
  where not exists (
    select 1 from group_students a
    where a.student_id = gs.student_id and a.status = 'active'
  )
  order by gs.student_id, gs.left_at desc nulls last
),
combined as (select * from target union all select * from fallback)
insert into _backup_student_branch_fix_20260706 (student_id, old_branch_id, new_branch_id, source)
select s.id, s.branch_id, c.new_branch, c.source
from students s
join combined c on c.student_id = s.id
where s.deleted_at is null
  and s.branch_id is distinct from c.new_branch
on conflict (student_id) do nothing;

-- 3. Apply the fix
update students s
set branch_id = b.new_branch_id, updated_at = now()
from _backup_student_branch_fix_20260706 b
where s.id = b.student_id;

-- 4. Hygiene: drop the active group membership that points at a deleted student
update group_students gs
set status = 'dropped',
    left_at = now(),
    notes = coalesce(gs.notes || ' | ', '') || 'auto-dropped 2026-07-06: student is soft-deleted'
from students s
where s.id = gs.student_id
  and gs.status = 'active'
  and s.deleted_at is not null;

-- 5. Hygiene: close ACTIVE enrollments of soft-deleted students (backup first)
create table if not exists _backup_enrollment_status_fix_20260706 as
select se.id, se.status, now() as backed_up_at
from student_enrollments se
where se.status = 'ACTIVE'
  and exists (select 1 from students s where s.id = se.student_id and s.deleted_at is not null);

update student_enrollments se
set status = 'DROPPED',
    updated_at = now(),
    notes = coalesce(se.notes || ' | ', '') || 'auto-dropped 2026-07-06: student is soft-deleted'
where se.status = 'ACTIVE'
  and exists (select 1 from students s where s.id = se.student_id and s.deleted_at is not null);
