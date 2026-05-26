-- Seed: roles
-- Insert the 5 system roles. These are immutable (is_system = true).

INSERT INTO public.roles (name, description, is_system) VALUES
  ('super_admin',  'Full system access across all branches',       true),
  ('team_leader',  'Branch management and student/instructor ops', true),
  ('instructor',   'Teaching, attendance, and grading',            true),
  ('student',      'Learning portal access',                       true),
  ('parent',       'Child progress monitoring portal',             true)
ON CONFLICT (name) DO NOTHING;
