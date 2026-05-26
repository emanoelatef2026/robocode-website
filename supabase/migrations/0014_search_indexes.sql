-- Migration: 0014_search_indexes
-- Purpose: Full-text search indexes and helper function for global search
-- Dependencies: all prior migrations
-- Strategy: PostgreSQL built-in FTS (pg_trgm + tsvector) for Phase 1-8.
--           Switch to pgvector + semantic search in Phase 9 (AI).

-- ─── Enable pg_trgm (trigram similarity for fuzzy search) ────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Search View: unified searchable entities ────────────────────────────────
-- A single view that combines all searchable entity types.
-- The global search API queries this view.
CREATE OR REPLACE VIEW public.search_index AS

  -- Students
  SELECT
    'student'::TEXT            AS entity_type,
    s.id                       AS entity_id,
    p.first_name || ' ' || p.last_name AS primary_text,
    s.student_code             AS secondary_text,
    s.branch_id,
    s.status                   AS entity_status,
    to_tsvector('english', p.first_name || ' ' || p.last_name || ' ' || COALESCE(s.student_code, '')) AS search_vector
  FROM public.students s
  JOIN public.users u ON u.id = s.user_id
  JOIN public.profiles p ON p.user_id = u.id
  WHERE s.deleted_at IS NULL

  UNION ALL

  -- Instructors
  SELECT
    'instructor'::TEXT,
    i.id,
    p.first_name || ' ' || p.last_name,
    i.employee_id,
    i.branch_id,
    i.status,
    to_tsvector('english', p.first_name || ' ' || p.last_name || ' ' || COALESCE(i.employee_id, ''))
  FROM public.instructors i
  JOIN public.users u ON u.id = i.user_id
  JOIN public.profiles p ON p.user_id = u.id
  WHERE i.deleted_at IS NULL

  UNION ALL

  -- Parents
  SELECT
    'parent'::TEXT,
    pa.id,
    p.first_name || ' ' || p.last_name,
    u.email,
    NULL::UUID,
    'active',
    to_tsvector('english', p.first_name || ' ' || p.last_name || ' ' || u.email)
  FROM public.parents pa
  JOIN public.users u ON u.id = pa.user_id
  JOIN public.profiles p ON p.user_id = u.id

  UNION ALL

  -- Groups
  SELECT
    'group'::TEXT,
    g.id,
    g.name,
    g.code,
    g.branch_id,
    g.status,
    to_tsvector('english', g.name || ' ' || COALESCE(g.code, ''))
  FROM public.groups g
  WHERE g.deleted_at IS NULL

  UNION ALL

  -- Courses
  SELECT
    'course'::TEXT,
    c.id,
    c.title,
    c.code,
    c.branch_id,
    CASE WHEN c.is_published THEN 'published' ELSE 'draft' END,
    to_tsvector('english', c.title || ' ' || COALESCE(c.description, '') || ' ' || COALESCE(c.code, ''))
  FROM public.courses c
  WHERE c.deleted_at IS NULL

  UNION ALL

  -- Lessons
  SELECT
    'lesson'::TEXT,
    l.id,
    l.title,
    NULL,
    NULL::UUID,
    CASE WHEN l.is_published THEN 'published' ELSE 'draft' END,
    to_tsvector('english', l.title)
  FROM public.lessons l
  WHERE l.deleted_at IS NULL

  UNION ALL

  -- Assignments
  SELECT
    'assignment'::TEXT,
    a.id,
    a.title,
    a.type,
    NULL::UUID,
    a.status,
    to_tsvector('english', a.title || ' ' || COALESCE(a.description, ''))
  FROM public.assignments a
  WHERE a.deleted_at IS NULL

  UNION ALL

  -- Announcements
  SELECT
    'announcement'::TEXT,
    an.id,
    an.title,
    NULL,
    an.branch_id,
    CASE WHEN an.deleted_at IS NULL THEN 'active' ELSE 'deleted' END,
    to_tsvector('english', an.title || ' ' || an.content)
  FROM public.announcements an
  WHERE an.deleted_at IS NULL
    AND (an.expires_at IS NULL OR an.expires_at > now());

-- ─── Search function: returns matching entities ───────────────────────────────
CREATE OR REPLACE FUNCTION public.search_entities(
  p_query     TEXT,
  p_branch_id UUID DEFAULT NULL,
  p_types     TEXT[] DEFAULT NULL,
  p_limit     INTEGER DEFAULT 20
)
RETURNS TABLE (
  entity_type   TEXT,
  entity_id     UUID,
  primary_text  TEXT,
  secondary_text TEXT,
  branch_id     UUID,
  rank          FLOAT4
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    si.entity_type,
    si.entity_id,
    si.primary_text,
    si.secondary_text,
    si.branch_id,
    ts_rank(si.search_vector, websearch_to_tsquery('english', p_query)) AS rank
  FROM public.search_index si
  WHERE
    si.search_vector @@ websearch_to_tsquery('english', p_query)
    AND (p_branch_id IS NULL OR si.branch_id = p_branch_id OR si.branch_id IS NULL)
    AND (p_types IS NULL OR si.entity_type = ANY(p_types))
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

-- ─── GIN indexes for trigram similarity (partial match, typo tolerance) ───────
-- These support ILIKE '%query%' style searches efficiently
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON public.profiles USING GIN (
    (first_name || ' ' || last_name) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_courses_title_trgm
  ON public.courses USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_groups_name_trgm
  ON public.groups USING GIN (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_title_trgm
  ON public.lessons USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_title_trgm
  ON public.announcements USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ─── GIN indexes for JSONB (analytics, settings) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_events_props
  ON public.analytics_events USING GIN (properties);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_metrics
  ON public.analytics_snapshots USING GIN (metrics);
