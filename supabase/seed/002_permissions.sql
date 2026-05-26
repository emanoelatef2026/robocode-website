-- Seed: permissions and role_permissions
-- Inserts all 30 permissions and assigns them to roles.

-- ─── Permissions ─────────────────────────────────────────────────────────────
INSERT INTO public.permissions (name, description, category) VALUES
  -- System
  ('manage_system',        'Full system control',                        'system'),
  ('manage_permissions',   'Edit role → permission assignments',         'system'),
  -- Organization
  ('manage_branches',      'Create/edit/delete branches',                'organization'),
  ('read_branches',        'View branch information',                    'organization'),
  ('manage_settings',      'Change org/branch settings',                 'organization'),
  -- Users
  ('manage_users',         'Create/deactivate any user',                 'users'),
  ('manage_students',      'Full CRUD on student records',               'users'),
  ('manage_instructors',   'Full CRUD on instructor records',            'users'),
  ('manage_parents',       'Full CRUD on parent records',                'users'),
  -- Academic
  ('manage_groups',        'Create/edit groups and cohorts',             'academic'),
  ('manage_courses',       'Create/edit/publish courses',                'academic'),
  ('manage_modules',       'Edit course modules',                        'academic'),
  ('manage_lessons',       'Edit lessons and resources',                 'academic'),
  ('manage_schedule',      'Create/edit class schedules',                'academic'),
  ('manage_attendance',    'Record and edit attendance',                 'academic'),
  ('read_attendance',      'View attendance records',                    'academic'),
  ('manage_assignments',   'Create/edit assignments',                    'academic'),
  ('grade_assignments',    'Grade student submissions',                  'academic'),
  ('read_grades',          'View student grades',                        'academic'),
  ('manage_quizzes',       'Create/edit quizzes',                        'academic'),
  ('manage_curriculum',    'Full curriculum control',                    'academic'),
  -- Financials
  ('manage_financials',    'Create invoices, record payments',           'financial'),
  ('read_financials',      'View financial reports',                     'financial'),
  -- Analytics
  ('read_analytics',       'View analytics dashboards',                  'analytics'),
  ('export_analytics',     'Export reports',                             'analytics'),
  -- Communication
  ('send_announcements',   'Create branch-wide announcements',           'communication'),
  ('send_notifications',   'Trigger manual notifications',               'communication'),
  ('manage_feedback',      'Write/edit instructor feedback notes',       'communication'),
  -- Content
  ('manage_media',         'Upload/delete media assets',                 'content'),
  ('read_media',           'View media assets',                          'content'),
  -- Audit
  ('read_audit_logs',      'View audit history',                         'audit'),
  -- AI
  ('manage_ai_agents',     'Configure AI agents',                        'ai'),
  ('read_ai_reports',      'View AI-generated reports',                  'ai')
ON CONFLICT (name) DO NOTHING;

-- ─── Role-Permission Assignments ─────────────────────────────────────────────
-- Super Admin: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Team Leader
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN (
  SELECT id FROM public.permissions WHERE name IN (
    'read_branches', 'manage_settings',
    'manage_students', 'manage_instructors', 'manage_parents',
    'manage_groups', 'manage_courses', 'manage_modules', 'manage_lessons',
    'manage_schedule', 'manage_attendance', 'read_attendance',
    'manage_assignments', 'grade_assignments', 'read_grades',
    'manage_quizzes', 'manage_curriculum',
    'manage_financials', 'read_financials',
    'read_analytics', 'export_analytics',
    'send_announcements', 'send_notifications', 'manage_feedback',
    'manage_media', 'read_media',
    'read_audit_logs', 'read_ai_reports'
  )
) p
WHERE r.name = 'team_leader'
ON CONFLICT DO NOTHING;

-- Instructor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN (
  SELECT id FROM public.permissions WHERE name IN (
    'read_branches',
    'manage_attendance', 'read_attendance',
    'manage_assignments', 'grade_assignments', 'read_grades',
    'manage_quizzes', 'manage_courses', 'manage_modules', 'manage_lessons',
    'send_announcements', 'manage_feedback',
    'manage_media', 'read_media',
    'read_analytics', 'read_ai_reports'
  )
) p
WHERE r.name = 'instructor'
ON CONFLICT DO NOTHING;

-- Student
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN (
  SELECT id FROM public.permissions WHERE name IN (
    'read_attendance', 'read_grades', 'read_media'
  )
) p
WHERE r.name = 'student'
ON CONFLICT DO NOTHING;

-- Parent
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN (
  SELECT id FROM public.permissions WHERE name IN (
    'read_attendance', 'read_grades', 'read_financials'
  )
) p
WHERE r.name = 'parent'
ON CONFLICT DO NOTHING;
