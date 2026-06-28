export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          org_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          org_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          org_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accreditations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string
          name: string
          sort_order: number
          website_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url: string
          name: string
          sort_order?: number
          website_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string
          name?: string
          sort_order?: number
          website_url?: string | null
        }
        Relationships: []
      }
      ai_interactions: {
        Row: {
          agent_type: string
          branch_id: string | null
          cost_usd: number | null
          created_at: string
          id: string
          input_hash: string | null
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          user_id: string | null
        }
        Insert: {
          agent_type: string
          branch_id?: string | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          input_hash?: string | null
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          branch_id?: string | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          input_hash?: string | null
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "ai_interactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "ai_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          acted_upon: boolean | null
          confidence_score: number | null
          content: Json
          created_at: string
          expires_at: string | null
          generated_by_agent: string
          id: string
          recommendation_type: string
          reviewed_by: string | null
          student_id: string | null
        }
        Insert: {
          acted_upon?: boolean | null
          confidence_score?: number | null
          content: Json
          created_at?: string
          expires_at?: string | null
          generated_by_agent: string
          id?: string
          recommendation_type: string
          reviewed_by?: string | null
          student_id?: string | null
        }
        Update: {
          acted_upon?: boolean | null
          confidence_score?: number | null
          content?: Json
          created_at?: string
          expires_at?: string | null
          generated_by_agent?: string
          id?: string
          recommendation_type?: string
          reviewed_by?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "ai_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      ai_reports: {
        Row: {
          content: string
          generated_at: string
          id: string
          period_end: string
          period_start: string
          report_type: string
          student_id: string
          viewed_by_parent_at: string | null
        }
        Insert: {
          content: string
          generated_at?: string
          id?: string
          period_end: string
          period_start: string
          report_type: string
          student_id: string
          viewed_by_parent_at?: string | null
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          report_type?: string
          student_id?: string
          viewed_by_parent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "ai_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          branch_id: string | null
          created_at: string
          device_type: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          device_type?: string | null
          event_name: string
          id?: number
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          device_type?: string | null
          event_name?: string
          id?: number
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "analytics_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events_default: {
        Row: {
          branch_id: string | null
          created_at: string
          device_type: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          device_type?: string | null
          event_name: string
          id?: number
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          device_type?: string | null
          event_name?: string
          id?: number
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_snapshots: {
        Row: {
          computed_at: string
          entity_id: string
          entity_type: string
          id: string
          metrics: Json
          period_end: string
          period_start: string
          snapshot_type: string
        }
        Insert: {
          computed_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metrics: Json
          period_end: string
          period_start: string
          snapshot_type: string
        }
        Update: {
          computed_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metrics?: Json
          period_end?: string
          period_start?: string
          snapshot_type?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          branch_id: string
          content: string
          created_at: string
          created_by: string
          deleted_at: string | null
          expires_at: string | null
          group_id: string | null
          id: string
          is_pinned: boolean
          published_at: string
          title: string
        }
        Insert: {
          branch_id: string
          content: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          expires_at?: string | null
          group_id?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string
          title: string
        }
        Update: {
          branch_id?: string
          content?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          expires_at?: string | null
          group_id?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
        ]
      }
      assignment_feedback: {
        Row: {
          content: string
          created_at: string
          given_by: string
          id: string
          is_public: boolean
          rubric_scores: Json
          submission_id: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          given_by: string
          id?: string
          is_public?: boolean
          rubric_scores?: Json
          submission_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          given_by?: string
          id?: string
          is_public?: boolean
          rubric_scores?: Json
          submission_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_feedback_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          ai_grading_enabled: boolean
          allow_late: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_at: string | null
          id: string
          instructions: string | null
          lesson_id: string | null
          max_resubmissions: number
          max_score: number
          module_id: string | null
          portfolio_eligible: boolean
          resubmission_allowed: boolean
          rubric: Json
          schedule_id: string | null
          status: string
          submission_type: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          ai_grading_enabled?: boolean
          allow_late?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          lesson_id?: string | null
          max_resubmissions?: number
          max_score?: number
          module_id?: string | null
          portfolio_eligible?: boolean
          resubmission_allowed?: boolean
          rubric?: Json
          schedule_id?: string | null
          status?: string
          submission_type?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          ai_grading_enabled?: boolean
          allow_late?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          lesson_id?: string | null
          max_resubmissions?: number
          max_score?: number
          module_id?: string | null
          portfolio_eligible?: boolean
          resubmission_allowed?: boolean
          rubric?: Json
          schedule_id?: string | null
          status?: string
          submission_type?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      attendance_consumptions: {
        Row: {
          attendance_record_id: string
          consumed_at: string
          enrollment_id: string
          id: string
          student_id: string
        }
        Insert: {
          attendance_record_id: string
          consumed_at?: string
          enrollment_id: string
          id?: string
          student_id: string
        }
        Update: {
          attendance_record_id?: string
          consumed_at?: string
          enrollment_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_funding_status"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_without_eligible_contract"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_consumption_integrity"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_orphan_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_unmatched_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          branch_name_snapshot: string | null
          course_name_snapshot: string | null
          enrollment_id: string | null
          group_name_snapshot: string | null
          id: string
          instructor_name_snapshot: string | null
          invalidated_at: string | null
          invalidation_reason: string | null
          late_minutes: number | null
          makeup_schedule_id: string | null
          materials_visible: boolean
          notes: string | null
          recorded_at: string
          recorded_by: string
          schedule_id: string
          session_date: string | null
          status: string
          student_id: string
        }
        Insert: {
          branch_name_snapshot?: string | null
          course_name_snapshot?: string | null
          enrollment_id?: string | null
          group_name_snapshot?: string | null
          id?: string
          instructor_name_snapshot?: string | null
          invalidated_at?: string | null
          invalidation_reason?: string | null
          late_minutes?: number | null
          makeup_schedule_id?: string | null
          materials_visible?: boolean
          notes?: string | null
          recorded_at?: string
          recorded_by: string
          schedule_id: string
          session_date?: string | null
          status: string
          student_id: string
        }
        Update: {
          branch_name_snapshot?: string | null
          course_name_snapshot?: string | null
          enrollment_id?: string | null
          group_name_snapshot?: string | null
          id?: string
          instructor_name_snapshot?: string | null
          invalidated_at?: string | null
          invalidation_reason?: string | null
          late_minutes?: number | null
          makeup_schedule_id?: string | null
          materials_visible?: boolean
          notes?: string | null
          recorded_at?: string
          recorded_by?: string
          schedule_id?: string
          session_date?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_makeup_schedule_id_fkey"
            columns: ["makeup_schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          impersonated_by: string | null
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          impersonated_by?: string | null
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          impersonated_by?: string | null
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "audit_logs_impersonated_by_fkey"
            columns: ["impersonated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          active: boolean
          author: string
          category: string
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          meta_description: string | null
          og_image: string | null
          published: boolean | null
          published_at: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          author?: string
          category?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          og_image?: string | null
          published?: boolean | null
          published_at?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          author?: string
          category?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          og_image?: string | null
          published?: boolean | null
          published_at?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          location: string | null
          location_data: Json
          name: string
          org_id: string
          phone: string
          settings: Json
          slug: string
          sort_order: number
          study_mode: string | null
          timezone: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          location_data?: Json
          name: string
          org_id: string
          phone: string
          settings?: Json
          slug: string
          sort_order?: number
          study_mode?: string | null
          timezone?: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          location_data?: Json
          name?: string
          org_id?: string
          phone?: string
          settings?: Json
          slug?: string
          sort_order?: number
          study_mode?: string | null
          timezone?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_snapshots: {
        Row: {
          assignment_score: number
          attendance_score: number
          calculated_at: string
          certificate_id: string
          courses_evaluated: number
          eligibility_detail: Json | null
          id: string
          is_eligible: boolean
          issued_at: string
          overall_score: number
          portfolio_score: number
          threshold_assignment: number
          threshold_attendance: number
          threshold_overall: number
        }
        Insert: {
          assignment_score?: number
          attendance_score?: number
          calculated_at?: string
          certificate_id: string
          courses_evaluated?: number
          eligibility_detail?: Json | null
          id?: string
          is_eligible: boolean
          issued_at?: string
          overall_score?: number
          portfolio_score?: number
          threshold_assignment: number
          threshold_attendance: number
          threshold_overall: number
        }
        Update: {
          assignment_score?: number
          attendance_score?: number
          calculated_at?: string
          certificate_id?: string
          courses_evaluated?: number
          eligibility_detail?: Json | null
          id?: string
          is_eligible?: boolean
          issued_at?: string
          overall_score?: number
          portfolio_score?: number
          threshold_assignment?: number
          threshold_attendance?: number
          threshold_overall?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_snapshots_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: true
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          accent_color: string
          background_color: string
          background_image_url: string | null
          branch_id: string | null
          certificate_type: string
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          signatory_name: string | null
          signatory_title: string | null
          signature_url: string | null
          stamp_url: string | null
          stem_logo_url: string | null
          template_html: string | null
          thumbnail_url: string | null
          track_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          background_image_url?: string | null
          branch_id?: string | null
          certificate_type?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          signatory_name?: string | null
          signatory_title?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          stem_logo_url?: string | null
          template_html?: string | null
          thumbnail_url?: string | null
          track_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          background_image_url?: string | null
          branch_id?: string | null
          certificate_type?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          signatory_name?: string | null
          signatory_title?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          stem_logo_url?: string | null
          template_html?: string | null
          thumbnail_url?: string | null
          track_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "certificate_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "certificate_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "certificate_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_templates_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          achievement_id: string | null
          branch_id: string | null
          certificate_code: string
          certificate_type: string
          course_id: string | null
          created_at: string
          description: string | null
          id: string
          issued_at: string
          issued_by: string | null
          pdf_url: string | null
          projects: Json
          recipient_name: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          semester_id: string | null
          status: string
          student_id: string
          template_id: string | null
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          achievement_id?: string | null
          branch_id?: string | null
          certificate_code: string
          certificate_type: string
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          pdf_url?: string | null
          projects?: Json
          recipient_name: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          semester_id?: string | null
          status?: string
          student_id: string
          template_id?: string | null
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          achievement_id?: string | null
          branch_id?: string | null
          certificate_code?: string
          certificate_type?: string
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          pdf_url?: string | null
          projects?: Json
          recipient_name?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          semester_id?: string | null
          status?: string
          student_id?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "student_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "certificates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_activities: {
        Row: {
          account_id: string | null
          activity_type: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          student_id: string
        }
        Insert: {
          account_id?: string | null
          activity_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          student_id: string
        }
        Update: {
          account_id?: string | null
          activity_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "student_financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "collection_activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_published: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          order_index: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_tools_used: string | null
          branch_id: string | null
          category: string | null
          code: string | null
          course_roadmap: string | null
          created_at: string
          created_by: string | null
          curriculum_folder: string | null
          curriculum_url: string | null
          deleted_at: string | null
          description: string | null
          drive_url: string | null
          estimated_hours: number | null
          expected_outcomes: string | null
          homework_drive_url: string | null
          id: string
          instructor_notes: string | null
          is_published: boolean
          level: string | null
          meeting_url: string | null
          preparation_notes: string | null
          prerequisite_course_id: string | null
          prerequisites: string | null
          recommended_age: string | null
          recommended_sessions: number | null
          resource_links: Json | null
          resources_url: string | null
          scope: string
          session_plans: string | null
          skills_covered: string | null
          syllabus_url: string | null
          teaching_guide: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_tools_used?: string | null
          branch_id?: string | null
          category?: string | null
          code?: string | null
          course_roadmap?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_folder?: string | null
          curriculum_url?: string | null
          deleted_at?: string | null
          description?: string | null
          drive_url?: string | null
          estimated_hours?: number | null
          expected_outcomes?: string | null
          homework_drive_url?: string | null
          id?: string
          instructor_notes?: string | null
          is_published?: boolean
          level?: string | null
          meeting_url?: string | null
          preparation_notes?: string | null
          prerequisite_course_id?: string | null
          prerequisites?: string | null
          recommended_age?: string | null
          recommended_sessions?: number | null
          resource_links?: Json | null
          resources_url?: string | null
          scope?: string
          session_plans?: string | null
          skills_covered?: string | null
          syllabus_url?: string | null
          teaching_guide?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_tools_used?: string | null
          branch_id?: string | null
          category?: string | null
          code?: string | null
          course_roadmap?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_folder?: string | null
          curriculum_url?: string | null
          deleted_at?: string | null
          description?: string | null
          drive_url?: string | null
          estimated_hours?: number | null
          expected_outcomes?: string | null
          homework_drive_url?: string | null
          id?: string
          instructor_notes?: string | null
          is_published?: boolean
          level?: string | null
          meeting_url?: string | null
          preparation_notes?: string | null
          prerequisite_course_id?: string | null
          prerequisites?: string | null
          recommended_age?: string | null
          recommended_sessions?: number | null
          resource_links?: Json | null
          resources_url?: string | null
          scope?: string
          session_plans?: string | null
          skills_covered?: string | null
          syllabus_url?: string | null
          teaching_guide?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "courses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_prerequisite_course_id_fkey"
            columns: ["prerequisite_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_prerequisite_course_id_fkey"
            columns: ["prerequisite_course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
        ]
      }
      discounts: {
        Row: {
          applies_to: string
          branch_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          name: string
          type: string
          uses_count: number
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          applies_to?: string
          branch_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name: string
          type: string
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          applies_to?: string
          branch_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string
          type?: string
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "discounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "discounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      external_videos: {
        Row: {
          branch_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_seconds: number | null
          embed_url: string | null
          entity_id: string | null
          entity_type: string | null
          external_id: string | null
          external_url: string
          file_size_bytes: number | null
          id: string
          is_public: boolean
          provider: string
          quality: string | null
          requires_auth: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploader_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          embed_url?: string | null
          entity_id?: string | null
          entity_type?: string | null
          external_id?: string | null
          external_url: string
          file_size_bytes?: number | null
          id?: string
          is_public?: boolean
          provider: string
          quality?: string | null
          requires_auth?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploader_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          embed_url?: string | null
          entity_id?: string | null
          entity_type?: string | null
          external_id?: string | null
          external_url?: string
          file_size_bytes?: number | null
          id?: string
          is_public?: boolean
          provider?: string
          quality?: string | null
          requires_auth?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_videos_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_videos_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "external_videos_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "external_videos_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          active: boolean
          answer: string
          category: string
          created_at: string
          id: string
          question: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          answer: string
          category?: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          answer?: string
          category?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled_for: Json
          id: string
          is_enabled: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_for?: Json
          id?: string
          is_enabled?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_for?: Json
          id?: string
          is_enabled?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      featured_students: {
        Row: {
          achievement_description: string | null
          achievement_title: string | null
          country: string
          created_at: string
          featured: boolean
          grade: string
          id: string
          image_url: string
          name: string
          sort_order: number
          youtube_url: string
        }
        Insert: {
          achievement_description?: string | null
          achievement_title?: string | null
          country: string
          created_at?: string
          featured?: boolean
          grade: string
          id?: string
          image_url: string
          name: string
          sort_order?: number
          youtube_url: string
        }
        Update: {
          achievement_description?: string | null
          achievement_title?: string | null
          country?: string
          created_at?: string
          featured?: boolean
          grade?: string
          id?: string
          image_url?: string
          name?: string
          sort_order?: number
          youtube_url?: string
        }
        Relationships: []
      }
      feedback_notes: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          group_id: string | null
          id: string
          instructor_id: string
          rating: number | null
          student_id: string
          visible_to_parent: boolean
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          instructor_id: string
          rating?: number | null
          student_id: string
          visible_to_parent?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          instructor_id?: string
          rating?: number | null
          student_id?: string
          visible_to_parent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "feedback_notes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      finance_adjustments: {
        Row: {
          adjustment_date: string
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          instructor_id: string | null
          notes: string | null
          staff_profile_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          adjustment_date?: string
          amount: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          staff_profile_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          adjustment_date?: string
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          staff_profile_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "finance_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "finance_adjustments_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_adjustments_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_payroll_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_installments: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_installments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "student_financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_notes: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_internal: boolean
          note_text: string
          student_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          note_text: string
          student_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          note_text?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "student_financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "finance_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      finance_payment_reversals: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          enrollment_id: string | null
          id: string
          original_payment_id: string
          reason: string | null
          reversal_type: string
          student_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          enrollment_id?: string | null
          id?: string
          original_payment_id: string
          reason?: string | null
          reversal_type?: string
          student_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          enrollment_id?: string | null
          id?: string
          original_payment_id?: string
          reason?: string | null
          reversal_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payment_reversals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "student_financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "finance_payment_reversals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          account_id: string
          allocation_strategy: string | null
          amount: number
          created_at: string
          created_by: string | null
          enrollment_id: string | null
          id: string
          installment_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string
          receipt_image: string | null
          receipt_notes: string | null
          receipt_url: string | null
          reference_number: string | null
          student_id: string
        }
        Insert: {
          account_id: string
          allocation_strategy?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          enrollment_id?: string | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_image?: string | null
          receipt_notes?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          student_id: string
        }
        Update: {
          account_id?: string
          allocation_strategy?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          enrollment_id?: string | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_image?: string | null
          receipt_notes?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "student_financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "finance_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "finance_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "finance_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "finance_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      financial_expenses: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          expense_date: string
          expense_scope: string
          expense_type: string
          group_id: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date: string
          expense_scope: string
          expense_type: string
          group_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          expense_scope?: string
          expense_type?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "financial_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "financial_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
        ]
      }
      gallery: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
        }
        Relationships: []
      }
      group_courses: {
        Row: {
          assigned_by: string | null
          course_id: string
          course_module_id: string | null
          created_at: string
          end_date: string | null
          ended_at: string | null
          group_id: string
          id: string
          instructor_id: string | null
          notes: string | null
          open_ended: boolean
          start_date: string | null
          started_at: string | null
          status: string
          total_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          course_id: string
          course_module_id?: string | null
          created_at?: string
          end_date?: string | null
          ended_at?: string | null
          group_id: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          open_ended?: boolean
          start_date?: string | null
          started_at?: string | null
          status?: string
          total_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          course_id?: string
          course_module_id?: string | null
          created_at?: string
          end_date?: string | null
          ended_at?: string | null
          group_id?: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          open_ended?: boolean
          start_date?: string | null
          started_at?: string | null
          status?: string
          total_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_courses_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "group_courses_course_module_id_fkey"
            columns: ["course_module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      group_instructors: {
        Row: {
          allocated_sessions: number | null
          allocation_status: string
          assigned_at: string
          created_at: string
          from_session: number
          group_id: string
          handoff_notes: string | null
          instructor_id: string
          released_at: string | null
          role: string
          session_rate: number | null
          to_session: number | null
        }
        Insert: {
          allocated_sessions?: number | null
          allocation_status?: string
          assigned_at?: string
          created_at?: string
          from_session?: number
          group_id: string
          handoff_notes?: string | null
          instructor_id: string
          released_at?: string | null
          role?: string
          session_rate?: number | null
          to_session?: number | null
        }
        Update: {
          allocated_sessions?: number | null
          allocation_status?: string
          assigned_at?: string
          created_at?: string
          from_session?: number
          group_id?: string
          handoff_notes?: string | null
          instructor_id?: string
          released_at?: string | null
          role?: string
          session_rate?: number | null
          to_session?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      group_students: {
        Row: {
          enrollment_type: string
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          notes: string | null
          status: string
          student_id: string
        }
        Insert: {
          enrollment_type?: string
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          status?: string
          student_id: string
        }
        Update: {
          enrollment_type?: string
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      groups: {
        Row: {
          branch_id: string
          capacity: number | null
          code: string | null
          completed_sessions: number
          created_at: string
          day_of_week: string | null
          deleted_at: string | null
          id: string
          metadata: Json
          name: string
          notes: string | null
          robocode_share_percent: number
          semester_id: string | null
          start_date: string | null
          status: string
          target_sessions: number
          time: string | null
          type: string
          updated_at: string
          waitlist_capacity: number
        }
        Insert: {
          branch_id: string
          capacity?: number | null
          code?: string | null
          completed_sessions?: number
          created_at?: string
          day_of_week?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name: string
          notes?: string | null
          robocode_share_percent?: number
          semester_id?: string | null
          start_date?: string | null
          status?: string
          target_sessions?: number
          time?: string | null
          type?: string
          updated_at?: string
          waitlist_capacity?: number
        }
        Update: {
          branch_id?: string
          capacity?: number | null
          code?: string | null
          completed_sessions?: number
          created_at?: string
          day_of_week?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          notes?: string | null
          robocode_share_percent?: number
          semester_id?: string | null
          start_date?: string | null
          status?: string
          target_sessions?: number
          time?: string | null
          type?: string
          updated_at?: string
          waitlist_capacity?: number
        }
        Relationships: [
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "groups_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_sections: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          key: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      installment_plans: {
        Row: {
          created_at: string
          id: string
          installments: number
          invoice_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installments: number
          invoice_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installments?: number
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          paid_at: string | null
          plan_id: string
          sort_order: number
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          paid_at?: string | null
          plan_id: string
          sort_order: number
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          plan_id?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          instructor_id: string
          is_primary: boolean
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          instructor_id: string
          is_primary?: boolean
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          instructor_id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "instructor_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructor_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructor_branches_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_certifications: {
        Row: {
          certification: string
          created_at: string
          expires_at: string | null
          id: string
          instructor_id: string
          issued_at: string | null
          level: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          certification: string
          created_at?: string
          expires_at?: string | null
          id?: string
          instructor_id: string
          issued_at?: string | null
          level?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          certification?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          instructor_id?: string
          issued_at?: string | null
          level?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_certifications_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_compensation: {
        Row: {
          base_amount: number
          bonus_amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          instructor_id: string
          notes: string | null
          period_end: string
          period_start: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          base_amount?: number
          bonus_amount?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          instructor_id: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          bonus_amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          instructor_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_compensation_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_compensation_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructor_compensation_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructor_compensation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_compensation_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_notes: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          id: string
          instructor_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          created_at?: string
          id?: string
          instructor_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          instructor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_notes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_payouts: {
        Row: {
          amount: number
          approved_by: string | null
          branch_id: string
          created_at: string
          currency: string
          id: string
          instructor_id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          period_end: string
          period_start: string
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          branch_id: string
          created_at?: string
          currency?: string
          id?: string
          instructor_id: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end: string
          period_start: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          branch_id?: string
          created_at?: string
          currency?: string
          id?: string
          instructor_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string
          period_start?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_payouts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payouts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payouts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructor_payouts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructor_payouts_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          alt_phone: string | null
          bank_account_number: string | null
          bio: string | null
          branch_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          employee_id: string | null
          facebook_url: string | null
          hire_date: string | null
          id: string
          instagram_url: string | null
          instapay_number: string | null
          instructor_code: string | null
          internal_notes: string | null
          max_weekly_load: number | null
          payment_link: string | null
          payment_method: string | null
          payment_notes: string | null
          payroll_effective_from: string | null
          payroll_type: string
          salary_per_session: number | null
          specializations: string[]
          status: string
          updated_at: string
          user_id: string
          wallet_number: string | null
          whatsapp_number: string | null
          working_days: string[]
        }
        Insert: {
          alt_phone?: string | null
          bank_account_number?: string | null
          bio?: string | null
          branch_id: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          employee_id?: string | null
          facebook_url?: string | null
          hire_date?: string | null
          id?: string
          instagram_url?: string | null
          instapay_number?: string | null
          instructor_code?: string | null
          internal_notes?: string | null
          max_weekly_load?: number | null
          payment_link?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payroll_effective_from?: string | null
          payroll_type?: string
          salary_per_session?: number | null
          specializations?: string[]
          status?: string
          updated_at?: string
          user_id: string
          wallet_number?: string | null
          whatsapp_number?: string | null
          working_days?: string[]
        }
        Update: {
          alt_phone?: string | null
          bank_account_number?: string | null
          bio?: string | null
          branch_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          employee_id?: string | null
          facebook_url?: string | null
          hire_date?: string | null
          id?: string
          instagram_url?: string | null
          instapay_number?: string | null
          instructor_code?: string | null
          internal_notes?: string | null
          max_weekly_load?: number | null
          payment_link?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payroll_effective_from?: string | null
          payroll_type?: string
          salary_per_session?: number | null
          specializations?: string[]
          status?: string
          updated_at?: string
          user_id?: string
          wallet_number?: string | null
          whatsapp_number?: string | null
          working_days?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "instructors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          discount_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string | null
          status: string
          student_id: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          status?: string
          student_id: string
          subtotal: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          status?: string
          student_id?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      lead_assignment_history: {
        Row: {
          assigned_by: string | null
          created_at: string
          from_user_id: string | null
          id: string
          lead_id: string
          reason: string | null
          to_user_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          to_user_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_timeline: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          lead_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          lead_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          age: number | null
          assigned_at: string | null
          assigned_to: string | null
          branch_id: string | null
          child_name: string
          converted_student_id: string | null
          created_at: string
          email: string | null
          id: string
          interested_course: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          parent_name: string | null
          phone: string | null
          source: string
          stage_entered_at: string
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          age?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          child_name: string
          converted_student_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_course?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          parent_name?: string | null
          phone?: string | null
          source?: string
          stage_entered_at?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          age?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          child_name?: string
          converted_student_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_course?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          parent_name?: string | null
          phone?: string | null
          source?: string
          stage_entered_at?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "leads_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "leads_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      learning_journey_stages: {
        Row: {
          active: boolean
          age_range: string
          created_at: string
          description: string
          id: string
          image_url: string
          outcomes: string[]
          skills: string[]
          sort_order: number
          technologies: string[]
          title: string
        }
        Insert: {
          active?: boolean
          age_range?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          outcomes?: string[]
          skills?: string[]
          sort_order?: number
          technologies?: string[]
          title: string
        }
        Update: {
          active?: boolean
          age_range?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          outcomes?: string[]
          skills?: string[]
          sort_order?: number
          technologies?: string[]
          title?: string
        }
        Relationships: []
      }
      learning_tracks: {
        Row: {
          age_range: string | null
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          difficulty_level: string
          id: string
          is_published: boolean
          name: string
          org_id: string
          slug: string
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          difficulty_level?: string
          id?: string
          is_published?: boolean
          name: string
          org_id: string
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          difficulty_level?: string
          id?: string
          is_published?: boolean
          name?: string
          org_id?: string
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_tracks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          student_id: string
          time_spent_seconds: number | null
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          student_id: string
          time_spent_seconds?: number | null
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          student_id?: string
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lesson_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          size_bytes: number | null
          sort_order: number
          storage_key: string | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          size_bytes?: number | null
          sort_order?: number
          storage_key?: string | null
          title: string
          type: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          size_bytes?: number | null
          sort_order?: number
          storage_key?: string | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: Json | null
          created_at: string
          deleted_at: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean
          module_id: string
          order_index: number
          title: string
          type: string
          updated_at: string
          video_id: string | null
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          module_id: string
          order_index: number
          title: string
          type?: string
          updated_at?: string
          video_id?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          module_id?: string
          order_index?: number
          title?: string
          type?: string
          updated_at?: string
          video_id?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          branch_id: string | null
          bucket: string
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          metadata: Json
          mime_type: string | null
          original_filename: string | null
          size_bytes: number | null
          storage_key: string
          uploader_id: string
          width: number | null
        }
        Insert: {
          branch_id?: string | null
          bucket: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_key: string
          uploader_id: string
          width?: number | null
        }
        Update: {
          branch_id?: string | null
          bucket?: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_key?: string
          uploader_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "media_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "media_assets_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          event_type: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          enabled?: boolean
          event_type: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          event_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          notification_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          notification_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          notification_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_tasks: {
        Row: {
          assigned_to: string | null
          auto_generated: boolean | null
          automation_trigger: string | null
          branch_id: string | null
          completed_at: string | null
          cooldown_until: string | null
          created_at: string
          created_by: string | null
          description: string | null
          dismissed_at: string | null
          dismissed_reason: string | null
          due_date: string | null
          enrollment_id: string | null
          id: string
          metadata: Json
          notes: string | null
          parent_id: string | null
          priority: string
          resolution_notes: string | null
          severity: string | null
          status: string
          student_id: string | null
          task_type: string
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          auto_generated?: boolean | null
          automation_trigger?: string | null
          branch_id?: string | null
          completed_at?: string | null
          cooldown_until?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dismissed_at?: string | null
          dismissed_reason?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          parent_id?: string | null
          priority?: string
          resolution_notes?: string | null
          severity?: string | null
          status?: string
          student_id?: string | null
          task_type: string
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          auto_generated?: boolean | null
          automation_trigger?: string | null
          branch_id?: string | null
          completed_at?: string | null
          cooldown_until?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dismissed_at?: string | null
          dismissed_reason?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          parent_id?: string | null
          priority?: string
          resolution_notes?: string | null
          severity?: string | null
          status?: string
          student_id?: string | null
          task_type?: string
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "operational_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "operational_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "operational_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "operational_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "operational_tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_feedback: {
        Row: {
          id: string
          notes: string | null
          parent_id: string
          q1_yes: boolean
          q2_yes: boolean
          q3_yes: boolean
          q4_yes: boolean
          rating: number
          session_milestone: number
          student_id: string
          submitted_at: string
        }
        Insert: {
          id?: string
          notes?: string | null
          parent_id: string
          q1_yes: boolean
          q2_yes: boolean
          q3_yes: boolean
          q4_yes: boolean
          rating: number
          session_milestone: number
          student_id: string
          submitted_at?: string
        }
        Update: {
          id?: string
          notes?: string | null
          parent_id?: string
          q1_yes?: boolean
          q2_yes?: boolean
          q3_yes?: boolean
          q4_yes?: boolean
          rating?: number
          session_milestone?: number
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_feedback_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_feedback_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_archived_families"
            referencedColumns: ["parent_id"]
          },
          {
            foreignKeyName: "parent_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "parent_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      parent_messages: {
        Row: {
          branch_id: string
          category: string
          created_at: string
          id: string
          image_url: string | null
          internal_note: string | null
          message: string
          parent_user_id: string
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          category: string
          created_at?: string
          id?: string
          image_url?: string | null
          internal_note?: string | null
          message: string
          parent_user_id: string
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          internal_note?: string | null
          message?: string
          parent_user_id?: string
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "parent_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "parent_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "parent_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      parent_students: {
        Row: {
          can_receive_notifications: boolean
          can_view_financials: boolean
          created_at: string
          id: string
          is_primary: boolean
          parent_id: string
          relationship: string
          student_id: string
        }
        Insert: {
          can_receive_notifications?: boolean
          can_view_financials?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_id: string
          relationship?: string
          student_id: string
        }
        Update: {
          can_receive_notifications?: boolean
          can_view_financials?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_id?: string
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_archived_families"
            referencedColumns: ["parent_id"]
          },
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          parent_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string
          name: string
          sort_order: number
          website_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url: string
          name: string
          sort_order?: number
          website_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string
          name?: string
          sort_order?: number
          website_url?: string | null
        }
        Relationships: []
      }
      payment_promises: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          promised_amount: number
          promised_date: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          promised_amount: number
          promised_date: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          promised_amount?: number
          promised_date?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_promises_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "student_financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payment_promises_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          installment_id: string | null
          invoice_id: string
          is_refund: boolean
          notes: string | null
          paid_at: string
          payment_method: string
          recorded_by: string | null
          reference: string | null
          refunds_payment: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          installment_id?: string | null
          invoice_id: string
          is_refund?: boolean
          notes?: string | null
          paid_at?: string
          payment_method?: string
          recorded_by?: string | null
          reference?: string | null
          refunds_payment?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          installment_id?: string | null
          invoice_id?: string
          is_refund?: boolean
          notes?: string | null
          paid_at?: string
          payment_method?: string
          recorded_by?: string | null
          reference?: string | null
          refunds_payment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_refunds_payment_fkey"
            columns: ["refunds_payment"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_session_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instructor_id: string
          notes: string | null
          override_rate: number
          reason: string | null
          schedule_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructor_id: string
          notes?: string | null
          override_rate: number
          reason?: string | null
          schedule_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructor_id?: string
          notes?: string | null
          override_rate?: number
          reason?: string | null
          schedule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_session_overrides_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_session_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      portfolio_projects: {
        Row: {
          category: string
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          drive_url: string | null
          final_score: number | null
          gallery_images: string[]
          github_url: string | null
          id: string
          instructor_feedback: string | null
          is_archived: boolean
          is_featured: boolean
          is_public: boolean
          portfolio_id: string
          project_url: string | null
          semester_id: string | null
          sort_order: number
          status: string
          student_id: string
          submission_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drive_url?: string | null
          final_score?: number | null
          gallery_images?: string[]
          github_url?: string | null
          id?: string
          instructor_feedback?: string | null
          is_archived?: boolean
          is_featured?: boolean
          is_public?: boolean
          portfolio_id: string
          project_url?: string | null
          semester_id?: string | null
          sort_order?: number
          status?: string
          student_id: string
          submission_id?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drive_url?: string | null
          final_score?: number | null
          gallery_images?: string[]
          github_url?: string | null
          id?: string
          instructor_feedback?: string | null
          is_archived?: boolean
          is_featured?: boolean
          is_public?: boolean
          portfolio_id?: string
          project_url?: string | null
          semester_id?: string | null
          sort_order?: number
          status?: string
          student_id?: string
          submission_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "portfolio_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "student_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "portfolio_projects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "portfolio_projects_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string
          gender: string | null
          id: string
          language_pref: string
          last_name: string
          nationality: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name: string
          gender?: string | null
          id?: string
          language_pref?: string
          last_name: string
          nationality?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          language_pref?: string
          last_name?: string
          nationality?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          passed: boolean | null
          quiz_id: string
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean | null
          quiz_id: string
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean | null
          quiz_id?: string
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          id: string
          is_correct: boolean
          order_index: number
          question_id: string
          text: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          order_index: number
          question_id: string
          text: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          order_index?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          order_index: number
          points: number
          question: string
          quiz_id: string
          type: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          order_index: number
          points?: number
          question: string
          quiz_id: string
          type: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          order_index?: number
          points?: number
          question?: string
          quiz_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          attempts_allowed: number
          created_at: string
          id: string
          instructions: string | null
          is_published: boolean
          lesson_id: string | null
          passing_score: number | null
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          attempts_allowed?: number
          created_at?: string
          id?: string
          instructions?: string | null
          is_published?: boolean
          lesson_id?: string | null
          passing_score?: number | null
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          attempts_allowed?: number
          created_at?: string
          id?: string
          instructions?: string | null
          is_published?: boolean
          lesson_id?: string | null
          passing_score?: number | null
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          active: boolean
          branch: string | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          rating: number | null
          review: string
          role: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          branch?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          rating?: number | null
          review: string
          role?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          branch?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          rating?: number | null
          review?: string
          role?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          branch_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          delivery: string | null
          duration_minutes: number
          ended_at: string | null
          group_course_id: string
          id: string
          legacy_missing_topic: boolean
          makeup_of_session_nr: number | null
          meeting_url: string | null
          notes: string | null
          original_session_id: string | null
          postponed_reason: string | null
          resources_links: Json | null
          room: string | null
          scheduled_at: string
          session_number: number | null
          started_at: string | null
          status: string
          topic: string | null
          type: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery?: string | null
          duration_minutes: number
          ended_at?: string | null
          group_course_id: string
          id?: string
          legacy_missing_topic?: boolean
          makeup_of_session_nr?: number | null
          meeting_url?: string | null
          notes?: string | null
          original_session_id?: string | null
          postponed_reason?: string | null
          resources_links?: Json | null
          room?: string | null
          scheduled_at: string
          session_number?: number | null
          started_at?: string | null
          status?: string
          topic?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery?: string | null
          duration_minutes?: number
          ended_at?: string | null
          group_course_id?: string
          id?: string
          legacy_missing_topic?: boolean
          makeup_of_session_nr?: number | null
          meeting_url?: string | null
          notes?: string | null
          original_session_id?: string | null
          postponed_reason?: string | null
          resources_links?: Json | null
          room?: string | null
          scheduled_at?: string
          session_number?: number | null
          started_at?: string | null
          status?: string
          topic?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedules_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      semester_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          semester_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          semester_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          semester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "semester_courses_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_enrollments: {
        Row: {
          branch_id: string
          certificate_id: string | null
          completed_at: string | null
          created_at: string
          dropped_at: string | null
          enrolled_at: string
          id: string
          notes: string | null
          payment_status: string
          semester_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          certificate_id?: string | null
          completed_at?: string | null
          created_at?: string
          dropped_at?: string | null
          enrolled_at?: string
          id?: string
          notes?: string | null
          payment_status?: string
          semester_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          certificate_id?: string | null
          completed_at?: string | null
          created_at?: string
          dropped_at?: string | null
          enrolled_at?: string
          id?: string
          notes?: string | null
          payment_status?: string
          semester_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "semester_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "semester_enrollments_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_enrollments_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "semester_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      semesters: {
        Row: {
          academic_year_id: string | null
          billing_cycle: string | null
          branch_id: string
          created_at: string
          end_date: string
          enrollment_close_at: string | null
          enrollment_open_at: string | null
          id: string
          is_active: boolean
          max_capacity: number | null
          name: string
          notes: string | null
          org_id: string | null
          semester_code: string | null
          slug: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          billing_cycle?: string | null
          branch_id: string
          created_at?: string
          end_date: string
          enrollment_close_at?: string | null
          enrollment_open_at?: string | null
          id?: string
          is_active?: boolean
          max_capacity?: number | null
          name: string
          notes?: string | null
          org_id?: string | null
          semester_code?: string | null
          slug?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          billing_cycle?: string | null
          branch_id?: string
          created_at?: string
          end_date?: string
          enrollment_close_at?: string | null
          enrollment_open_at?: string | null
          id?: string
          is_active?: boolean
          max_capacity?: number | null
          name?: string
          notes?: string | null
          org_id?: string | null
          semester_code?: string | null
          slug?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semesters_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semesters_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semesters_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "semesters_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "semesters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feedback: {
        Row: {
          comment: string | null
          id: string
          q1_score: number
          q2_score: number
          q3_score: number
          schedule_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          comment?: string | null
          id?: string
          q1_score: number
          q2_score: number
          q3_score: number
          schedule_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          comment?: string | null
          id?: string
          q1_score?: number
          q2_score?: number
          q3_score?: number
          schedule_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "session_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      session_instructors: {
        Row: {
          created_at: string
          id: string
          instructor_id: string
          session_id: string
          submitted_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_id: string
          session_id: string
          submitted_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instructor_id?: string
          session_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      session_milestone_alerts: {
        Row: {
          alert_type: string
          branch_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          milestone_session: number
          notes: string | null
          resolved_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          alert_type: string
          branch_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          milestone_session: number
          notes?: string | null
          resolved_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          alert_type?: string
          branch_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          milestone_session?: number
          notes?: string | null
          resolved_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_milestone_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "session_milestone_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      session_payments: {
        Row: {
          amount: number
          compensation_id: string | null
          created_at: string
          currency: string
          id: string
          instructor_id: string
          session_id: string
          status: string
        }
        Insert: {
          amount?: number
          compensation_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          instructor_id: string
          session_id: string
          status?: string
        }
        Update: {
          amount?: number
          compensation_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          instructor_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_payments_compensation_id_fkey"
            columns: ["compensation_id"]
            isOneToOne: false
            referencedRelation: "instructor_compensation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      session_recordings: {
        Row: {
          branch_id: string
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          external_id: string | null
          external_url: string
          id: string
          provider: string
          recorded_by: string | null
          schedule_id: string
          title: string | null
          visible_to_parents: boolean
          visible_to_students: boolean
        }
        Insert: {
          branch_id: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          external_id?: string | null
          external_url: string
          id?: string
          provider: string
          recorded_by?: string | null
          schedule_id: string
          title?: string | null
          visible_to_parents?: boolean
          visible_to_students?: boolean
        }
        Update: {
          branch_id?: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          external_id?: string | null
          external_url?: string
          id?: string
          provider?: string
          recorded_by?: string | null
          schedule_id?: string
          title?: string | null
          visible_to_parents?: boolean
          visible_to_students?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "session_recordings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "session_recordings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "session_recordings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      settings: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      site_media: {
        Row: {
          id: string
          image_url: string
          key: string
          updated_at: string
        }
        Insert: {
          id?: string
          image_url?: string
          key: string
          updated_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_payment_records: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          month: number
          notes: string | null
          payment_date: string
          payment_method: string | null
          staff_profile_id: string
          year: number
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          staff_profile_id: string
          year: number
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          staff_profile_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_payment_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payment_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_payment_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_payment_records_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_payroll_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payroll_profiles: {
        Row: {
          basic_salary: number
          branch_id: string
          created_at: string
          created_by: string | null
          department: string | null
          employment_status: string
          id: string
          is_payroll_enabled: boolean
          notes: string | null
          payment_method: string
          payment_reference: string | null
          payroll_type: string
          role: string
          session_rate: number
          updated_at: string
          user_id: string
          works_all_branches: boolean
        }
        Insert: {
          basic_salary?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          employment_status?: string
          id?: string
          is_payroll_enabled?: boolean
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          payroll_type?: string
          role?: string
          session_rate?: number
          updated_at?: string
          user_id: string
          works_all_branches?: boolean
        }
        Update: {
          basic_salary?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          employment_status?: string
          id?: string
          is_payroll_enabled?: boolean
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          payroll_type?: string
          role?: string
          session_rate?: number
          updated_at?: string
          user_id?: string
          works_all_branches?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "staff_payroll_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payroll_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_payroll_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      staff_sessions: {
        Row: {
          activity_type: string
          branch_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          quantity: number
          rate: number
          session_date: string
          staff_profile_id: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          rate?: number
          session_date?: string
          staff_profile_id: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          rate?: number
          session_date?: string
          staff_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_sessions_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_payroll_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_achievements: {
        Row: {
          achievement_type: string
          created_at: string
          created_by: string | null
          date_awarded: string
          description: string | null
          id: string
          image_url: string | null
          portfolio_id: string | null
          sort_order: number
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          achievement_type?: string
          created_at?: string
          created_by?: string | null
          date_awarded?: string
          description?: string | null
          id?: string
          image_url?: string | null
          portfolio_id?: string | null
          sort_order?: number
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          achievement_type?: string
          created_at?: string
          created_by?: string | null
          date_awarded?: string
          description?: string | null
          id?: string
          image_url?: string | null
          portfolio_id?: string | null
          sort_order?: number
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_achievements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "student_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_badges: {
        Row: {
          awarded_at: string
          badge_image: string | null
          badge_name: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          portfolio_id: string | null
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_image?: string | null
          badge_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          portfolio_id?: string | null
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_image?: string | null
          badge_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          portfolio_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "student_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_certificates: {
        Row: {
          certificate_number: string
          completion_date: string
          course_id: string | null
          course_title: string | null
          created_at: string
          id: string
          is_revoked: boolean
          issued_at: string
          issued_by: string | null
          pdf_url: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          student_id: string
          student_name: string
          template_id: string
          track_id: string | null
          track_name: string | null
        }
        Insert: {
          certificate_number?: string
          completion_date: string
          course_id?: string | null
          course_title?: string | null
          created_at?: string
          id?: string
          is_revoked?: boolean
          issued_at?: string
          issued_by?: string | null
          pdf_url?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          student_id: string
          student_name: string
          template_id: string
          track_id?: string | null
          track_name?: string | null
        }
        Update: {
          certificate_number?: string
          completion_date?: string
          course_id?: string | null
          course_title?: string | null
          created_at?: string
          id?: string
          is_revoked?: boolean
          issued_at?: string
          issued_by?: string | null
          pdf_url?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          student_id?: string
          student_name?: string
          template_id?: string
          track_id?: string | null
          track_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "student_certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_certificates_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_course_progress: {
        Row: {
          assignment_score: number
          attendance_score: number
          completion_percentage: number
          course_id: string
          created_at: string
          group_id: string
          id: string
          last_calculated_at: string
          portfolio_score: number
          semester_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_score?: number
          attendance_score?: number
          completion_percentage?: number
          course_id: string
          created_at?: string
          group_id: string
          id?: string
          last_calculated_at?: string
          portfolio_score?: number
          semester_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_score?: number
          attendance_score?: number
          completion_percentage?: number
          course_id?: string
          created_at?: string
          group_id?: string
          id?: string
          last_calculated_at?: string
          portfolio_score?: number
          semester_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_course_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          attendance_count: number
          branch_id: string
          branch_name_snapshot: string | null
          completion_percentage: number
          consumed_sessions: number
          contract_code: string | null
          course_id: string | null
          course_name_snapshot: string | null
          created_at: string
          created_by: string | null
          discount_amount: number
          end_date: string | null
          enrolled_sessions: number
          enrollment_type: string
          expected_sessions: number
          financial_status: string | null
          group_course_id: string | null
          group_id: string | null
          group_name_snapshot: string | null
          group_student_id: string | null
          id: string
          instructor_id: string | null
          instructor_name_snapshot: string | null
          net_amount: number
          notes: string | null
          pricing_plan: string | null
          pricing_snapshot: Json
          remaining_sessions: number | null
          start_date: string
          status: string
          student_id: string
          total_amount: number
          transferred_from: string | null
          transferred_to: string | null
          updated_at: string
        }
        Insert: {
          attendance_count?: number
          branch_id: string
          branch_name_snapshot?: string | null
          completion_percentage?: number
          consumed_sessions?: number
          contract_code?: string | null
          course_id?: string | null
          course_name_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          end_date?: string | null
          enrolled_sessions?: number
          enrollment_type?: string
          expected_sessions?: number
          financial_status?: string | null
          group_course_id?: string | null
          group_id?: string | null
          group_name_snapshot?: string | null
          group_student_id?: string | null
          id?: string
          instructor_id?: string | null
          instructor_name_snapshot?: string | null
          net_amount?: number
          notes?: string | null
          pricing_plan?: string | null
          pricing_snapshot?: Json
          remaining_sessions?: number | null
          start_date?: string
          status?: string
          student_id: string
          total_amount?: number
          transferred_from?: string | null
          transferred_to?: string | null
          updated_at?: string
        }
        Update: {
          attendance_count?: number
          branch_id?: string
          branch_name_snapshot?: string | null
          completion_percentage?: number
          consumed_sessions?: number
          contract_code?: string | null
          course_id?: string | null
          course_name_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          end_date?: string | null
          enrolled_sessions?: number
          enrollment_type?: string
          expected_sessions?: number
          financial_status?: string | null
          group_course_id?: string | null
          group_id?: string | null
          group_name_snapshot?: string | null
          group_student_id?: string | null
          id?: string
          instructor_id?: string | null
          instructor_name_snapshot?: string | null
          net_amount?: number
          notes?: string | null
          pricing_plan?: string | null
          pricing_snapshot?: Json
          remaining_sessions?: number | null
          start_date?: string
          status?: string
          student_id?: string
          total_amount?: number
          transferred_from?: string | null
          transferred_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "student_enrollments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_student_id_fkey"
            columns: ["group_student_id"]
            isOneToOne: false
            referencedRelation: "group_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
        ]
      }
      student_financial_accounts: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          enrollment_id: string | null
          group_id: string | null
          id: string
          net_amount: number
          next_due_date: string | null
          notes: string | null
          paid_amount: number
          remaining_amount: number
          status: string
          student_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          enrollment_id?: string | null
          group_id?: string | null
          id?: string
          net_amount?: number
          next_due_date?: string | null
          notes?: string | null
          paid_amount?: number
          remaining_amount?: number
          status?: string
          student_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          enrollment_id?: string | null
          group_id?: string | null
          id?: string
          net_amount?: number
          next_due_date?: string | null
          notes?: string | null
          paid_amount?: number
          remaining_amount?: number
          status?: string
          student_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_financial_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_financial_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_financial_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_financial_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_grade_summaries: {
        Row: {
          earned_score: number
          grade_percentage: number | null
          graded_count: number
          group_course_id: string
          id: string
          last_updated_at: string
          student_id: string
          submitted_count: number
          total_assignments: number
          total_possible_score: number
        }
        Insert: {
          earned_score?: number
          grade_percentage?: number | null
          graded_count?: number
          group_course_id: string
          id?: string
          last_updated_at?: string
          student_id: string
          submitted_count?: number
          total_assignments?: number
          total_possible_score?: number
        }
        Update: {
          earned_score?: number
          grade_percentage?: number | null
          graded_count?: number
          group_course_id?: string
          id?: string
          last_updated_at?: string
          student_id?: string
          submitted_count?: number
          total_assignments?: number
          total_possible_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_grade_summaries_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grade_summaries_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
          {
            foreignKeyName: "student_grade_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grade_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_grade_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_private: boolean
          schedule_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_private?: boolean
          schedule_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean
          schedule_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_parent_contacts: {
        Row: {
          created_at: string
          id: string
          is_emergency: boolean
          is_primary: boolean
          name: string
          notes: string | null
          parent_group_id: string
          phone1: string | null
          phone2: string | null
          relation: string
          status: string
          student_id: string
          whatsapp_preferred: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          name?: string
          notes?: string | null
          parent_group_id: string
          phone1?: string | null
          phone2?: string | null
          relation?: string
          status?: string
          student_id: string
          whatsapp_preferred?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          name?: string
          notes?: string | null
          parent_group_id?: string
          phone1?: string | null
          phone2?: string | null
          relation?: string
          status?: string
          student_id?: string
          whatsapp_preferred?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_parent_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parent_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_parent_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_portfolios: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          is_public: boolean
          student_id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          student_id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_portfolios_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_portfolios_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_portfolios_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_progress: {
        Row: {
          completed_at: string | null
          completed_lessons: number
          completion_percentage: number
          group_course_id: string
          id: string
          last_activity_at: string | null
          started_at: string | null
          student_id: string
          total_lessons: number
        }
        Insert: {
          completed_at?: string | null
          completed_lessons?: number
          completion_percentage?: number
          group_course_id: string
          id?: string
          last_activity_at?: string | null
          started_at?: string | null
          student_id: string
          total_lessons?: number
        }
        Update: {
          completed_at?: string | null
          completed_lessons?: number
          completion_percentage?: number
          group_course_id?: string
          id?: string
          last_activity_at?: string | null
          started_at?: string | null
          student_id?: string
          total_lessons?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_projects: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          course_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          drive_url: string | null
          github_url: string | null
          id: string
          image_url: string | null
          sort_order: number | null
          status: string
          student_id: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          course_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          drive_url?: string | null
          github_url?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number | null
          status?: string
          student_id?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          course_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          drive_url?: string | null
          github_url?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number | null
          status?: string
          student_id?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      student_timeline_events: {
        Row: {
          actor_user_id: string | null
          branch_id: string | null
          created_at: string
          enrollment_id: string | null
          id: string
          metadata: Json
          severity: string
          student_id: string | null
          type: string
        }
        Insert: {
          actor_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          metadata?: Json
          severity?: string
          student_id?: string | null
          type: string
        }
        Update: {
          actor_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          metadata?: Json
          severity?: string
          student_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_timeline_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_timeline_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_timeline_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_timeline_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "student_timeline_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_timeline_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_timeline_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          age: number | null
          best_streak: number
          branch_id: string
          created_at: string
          current_level: number
          current_streak: number
          date_of_birth: string | null
          deleted_at: string | null
          emergency_contact: Json
          enrollment_date: string
          grade: string | null
          id: string
          last_activity_date: string | null
          notes: string | null
          portal_password: string | null
          school_grade: string | null
          status: string
          student_code: string | null
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          best_streak?: number
          branch_id: string
          created_at?: string
          current_level?: number
          current_streak?: number
          date_of_birth?: string | null
          deleted_at?: string | null
          emergency_contact?: Json
          enrollment_date?: string
          grade?: string | null
          id?: string
          last_activity_date?: string | null
          notes?: string | null
          portal_password?: string | null
          school_grade?: string | null
          status?: string
          student_code?: string | null
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          age?: number | null
          best_streak?: number
          branch_id?: string
          created_at?: string
          current_level?: number
          current_streak?: number
          date_of_birth?: string | null
          deleted_at?: string | null
          emergency_contact?: Json
          enrollment_date?: string
          grade?: string | null
          id?: string
          last_activity_date?: string | null
          notes?: string | null
          portal_password?: string | null
          school_grade?: string | null
          status?: string
          student_code?: string | null
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          ai_feedback: string | null
          ai_score: number | null
          assignment_id: string
          content: string | null
          created_at: string
          drive_url: string | null
          feedback: string | null
          file_keys: string[]
          github_url: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          image_urls: string[]
          is_late: boolean
          portfolio_visible: boolean
          project_url: string | null
          public_feedback: string | null
          resubmission_count: number
          rubric_scores: Json
          score: number | null
          status: string
          student_id: string
          submission_type: string | null
          submitted_at: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          ai_feedback?: string | null
          ai_score?: number | null
          assignment_id: string
          content?: string | null
          created_at?: string
          drive_url?: string | null
          feedback?: string | null
          file_keys?: string[]
          github_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          image_urls?: string[]
          is_late?: boolean
          portfolio_visible?: boolean
          project_url?: string | null
          public_feedback?: string | null
          resubmission_count?: number
          rubric_scores?: Json
          score?: number | null
          status?: string
          student_id: string
          submission_type?: string | null
          submitted_at?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          ai_feedback?: string | null
          ai_score?: number | null
          assignment_id?: string
          content?: string | null
          created_at?: string
          drive_url?: string | null
          feedback?: string | null
          file_keys?: string[]
          github_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          image_urls?: string[]
          is_late?: boolean
          portfolio_visible?: boolean
          project_url?: string | null
          public_feedback?: string | null
          resubmission_count?: number
          rubric_scores?: Json
          score?: number | null
          status?: string
          student_id?: string
          submission_type?: string | null
          submitted_at?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          amount: number
          billing_cycle: string
          branch_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          amount: number
          billing_cycle: string
          branch_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          branch_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "subscription_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      track_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_required: boolean
          order_index: number
          track_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          order_index: number
          track_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          order_index?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "track_courses_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_bookings: {
        Row: {
          age: number | null
          another_phone: string | null
          created_at: string
          id: string
          notes: string | null
          phone: string
          preferred_day: string
          preferred_time: string
          school: string | null
          status: string
          student_name: string
        }
        Insert: {
          age?: number | null
          another_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone: string
          preferred_day: string
          preferred_time: string
          school?: string | null
          status?: string
          student_name: string
        }
        Update: {
          age?: number | null
          another_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string
          preferred_day?: string
          preferred_time?: string
          school?: string | null
          status?: string
          student_name?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          branch_id: string | null
          created_at: string
          id: string
          role_id: string
          tl_code: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          role_id: string
          tl_code?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          role_id?: string
          tl_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_roles_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_roles_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "fk_user_roles_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          metadata: Json
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          metadata?: Json
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          metadata?: Json
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      why_robocode_settings: {
        Row: {
          id: string
          section_subtitle: string
          section_title: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          section_subtitle?: string
          section_title?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          section_subtitle?: string
          section_title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      why_robocode_tabs: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          tab_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          tab_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          tab_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      search_index: {
        Row: {
          branch_id: string | null
          entity_id: string | null
          entity_status: string | null
          entity_type: string | null
          primary_text: string | null
          search_vector: unknown
          secondary_text: string | null
        }
        Relationships: []
      }
      v_allocation_gaps: {
        Row: {
          gap_from: number | null
          gap_to: number | null
          group_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
        ]
      }
      v_archived_families: {
        Row: {
          archived_children: number | null
          parent_email: string | null
          parent_id: string | null
          total_children: number | null
        }
        Relationships: []
      }
      v_attendance_drift: {
        Row: {
          drift: number | null
          enrolled_sessions: number | null
          enrollment_id: string | null
          group_id: string | null
          group_name: string | null
          ledger_consumed: number | null
          start_date: string | null
          status: string | null
          stored_consumed: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_attendance_funding_status: {
        Row: {
          attendance_record_id: string | null
          branch_id: string | null
          branch_name_snapshot: string | null
          course_name_snapshot: string | null
          enrollment_id: string | null
          funding_status: string | null
          group_name_snapshot: string | null
          instructor_name_snapshot: string | null
          recorded_at: string | null
          schedule_id: string | null
          session_date: string | null
          status: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_attendance_without_eligible_contract: {
        Row: {
          attendance_record_id: string | null
          attendance_status: string | null
          enrollment_id: string | null
          enrollment_start_date: string | null
          group_course_id: string | null
          session_date: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
        ]
      }
      v_cancelled_sessions_with_consumption: {
        Row: {
          attendance_record_id: string | null
          attendance_status: string | null
          consumed_at: string | null
          consumption_id: string | null
          enrollment_id: string | null
          group_id: string | null
          invalidated_at: string | null
          invalidation_reason: string | null
          schedule_id: string | null
          schedule_status: string | null
          session_number: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
        ]
      }
      v_consumption_integrity: {
        Row: {
          attendance_record_id: string | null
          enrollment_id: string | null
          ledger_state: string | null
          recorded_at: string | null
          schedule_id: string | null
          status: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_contract_consumption_mismatch: {
        Row: {
          drift: number | null
          enrollment_id: string | null
          ledger_consumed: number | null
          stored_consumed: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_dashboard_overview: {
        Row: {
          active_groups: number | null
          active_students: number | null
          avg_attendance_pct: number | null
          branch_id: string | null
          branch_name: string | null
          groups_missing_instructor: number | null
          overdue_accounts: number | null
          sessions_exhausted: number | null
          sessions_missing_attendance: number | null
          total_outstanding_egp: number | null
        }
        Insert: {
          active_groups?: never
          active_students?: never
          avg_attendance_pct?: never
          branch_id?: string | null
          branch_name?: string | null
          groups_missing_instructor?: never
          overdue_accounts?: never
          sessions_exhausted?: never
          sessions_missing_attendance?: never
          total_outstanding_egp?: never
        }
        Update: {
          active_groups?: never
          active_students?: never
          avg_attendance_pct?: never
          branch_id?: string | null
          branch_name?: string | null
          groups_missing_instructor?: never
          overdue_accounts?: never
          sessions_exhausted?: never
          sessions_missing_attendance?: never
          total_outstanding_egp?: never
        }
        Relationships: []
      }
      v_enrollment_academic_progress: {
        Row: {
          completion_pct: number | null
          consumed_ledger: number | null
          consumed_stored: number | null
          consumption_drift: number | null
          end_date: string | null
          enrolled_sessions: number | null
          enrollment_id: string | null
          group_id: string | null
          is_renewal_ready: boolean | null
          remaining_sessions: number | null
          start_date: string | null
          status: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_enrollment_integrity: {
        Row: {
          drift: number | null
          enrolled_sessions: number | null
          enrollment_id: string | null
          ledger_consumed: number | null
          remaining_sessions: number | null
          status: string | null
          stored_consumed: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_enrollment_session_integrity: {
        Row: {
          attendance_record_id: string | null
          attendance_status: string | null
          consumption_id: string | null
          enrollment_end: string | null
          enrollment_id: string | null
          enrollment_start: string | null
          integrity_status: string | null
          invalidated_at: string | null
          session_date: string | null
          session_status: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_funding_status"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_without_eligible_contract"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_consumption_integrity"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_orphan_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_unmatched_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
        ]
      }
      v_finance_contract_summary: {
        Row: {
          assigned_group: string | null
          contract_code: string | null
          course_name: string | null
          created_at: string | null
          enrollment_id: string | null
          financial_status: string | null
          instructor: string | null
          paid_amount: number | null
          remaining_amount: number | null
          sessions_remaining: number | null
          sessions_total: number | null
          sessions_used: number | null
          student_id: string | null
          student_name: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      v_financial_collection_health: {
        Row: {
          blocked_count: number | null
          branch_id: string | null
          branch_name: string | null
          collected_this_month: number | null
          collection_rate_pct: number | null
          due_soon_count: number | null
          healthy_count: number | null
          overdue_count: number | null
          payments_this_month: number | null
          total_accounts: number | null
          total_billed: number | null
          total_collected: number | null
          total_outstanding: number | null
        }
        Relationships: []
      }
      v_group_attendance_mismatch: {
        Row: {
          actual_completed: number | null
          drift: number | null
          group_id: string | null
          group_name: string | null
          stored_completed: number | null
        }
        Relationships: []
      }
      v_group_count_drift: {
        Row: {
          delivered_sessions: number | null
          delivery_status: string | null
          group_course_id: string | null
          group_id: string | null
          group_name: string | null
          planned_sessions: number | null
          sessions_remaining: number | null
        }
        Relationships: []
      }
      v_group_health: {
        Row: {
          active_students: number | null
          avg_assignment_pct: number | null
          avg_attendance_pct: number | null
          branch_id: string | null
          capacity: number | null
          capacity_pct: number | null
          course_id: string | null
          course_name: string | null
          critical_sessions_count: number | null
          day_of_week: string | null
          group_id: string | null
          group_name: string | null
          group_status: string | null
          group_time: string | null
          instructor_id: string | null
          instructor_name: string | null
          last_session_date: string | null
          next_session_at: string | null
          sessions_missing_attendance: number | null
          start_date: string | null
          unpaid_students: number | null
        }
        Insert: {
          active_students?: never
          avg_assignment_pct?: never
          avg_attendance_pct?: never
          branch_id?: string | null
          capacity?: number | null
          capacity_pct?: never
          course_id?: never
          course_name?: never
          critical_sessions_count?: never
          day_of_week?: string | null
          group_id?: string | null
          group_name?: string | null
          group_status?: string | null
          group_time?: string | null
          instructor_id?: never
          instructor_name?: never
          last_session_date?: never
          next_session_at?: never
          sessions_missing_attendance?: never
          start_date?: string | null
          unpaid_students?: never
        }
        Update: {
          active_students?: never
          avg_assignment_pct?: never
          avg_attendance_pct?: never
          branch_id?: string | null
          capacity?: number | null
          capacity_pct?: never
          course_id?: never
          course_name?: never
          critical_sessions_count?: never
          day_of_week?: string | null
          group_id?: string | null
          group_name?: string | null
          group_status?: string | null
          group_time?: string | null
          instructor_id?: never
          instructor_name?: never
          last_session_date?: never
          next_session_at?: never
          sessions_missing_attendance?: never
          start_date?: string | null
          unpaid_students?: never
        }
        Relationships: [
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_group_progress_integrity: {
        Row: {
          actual_completed: number | null
          cancelled_session_count: number | null
          drift: number | null
          group_id: string | null
          group_name: string | null
          stale_attendance_on_cancelled: number | null
          stored_completed: number | null
        }
        Insert: {
          actual_completed?: never
          cancelled_session_count?: never
          drift?: never
          group_id?: string | null
          group_name?: string | null
          stale_attendance_on_cancelled?: never
          stored_completed?: number | null
        }
        Update: {
          actual_completed?: never
          cancelled_session_count?: never
          drift?: never
          group_id?: string | null
          group_name?: string | null
          stale_attendance_on_cancelled?: never
          stored_completed?: number | null
        }
        Relationships: []
      }
      v_group_readiness: {
        Row: {
          computed_active: boolean | null
          computed_status: string | null
          group_id: string | null
          group_name: string | null
          has_course: boolean | null
          has_instructor: boolean | null
          status_drift: boolean | null
          stored_status: string | null
        }
        Relationships: []
      }
      v_instructor_allocation_summary: {
        Row: {
          allocated_sessions: number | null
          allocation_status: string | null
          assigned_at: string | null
          from_session: number | null
          group_id: string | null
          handoff_notes: string | null
          highest_consumed_session: number | null
          instructor_id: string | null
          released_at: string | null
          role: string | null
          sessions_completed_in_range: number | null
          to_session: number | null
        }
        Insert: {
          allocated_sessions?: number | null
          allocation_status?: string | null
          assigned_at?: string | null
          from_session?: number | null
          group_id?: string | null
          handoff_notes?: string | null
          highest_consumed_session?: never
          instructor_id?: string | null
          released_at?: string | null
          role?: string | null
          sessions_completed_in_range?: never
          to_session?: number | null
        }
        Update: {
          allocated_sessions?: number | null
          allocation_status?: string | null
          assigned_at?: string | null
          from_session?: number | null
          group_id?: string | null
          handoff_notes?: string | null
          highest_consumed_session?: never
          instructor_id?: string | null
          released_at?: string | null
          role?: string | null
          sessions_completed_in_range?: never
          to_session?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_instructor_overlap_audit: {
        Row: {
          a_from: number | null
          a_to: number | null
          b_from: number | null
          b_to: number | null
          group_id: string | null
          instructor_a_id: string | null
          instructor_b_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_instructor_id_fkey"
            columns: ["instructor_b_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instructors_instructor_id_fkey"
            columns: ["instructor_a_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_instructor_progress_drift: {
        Row: {
          allocated_sessions: number | null
          drift_status: string | null
          from_session: number | null
          group_delivered_sessions: number | null
          group_id: string | null
          group_planned_sessions: number | null
          instructor_id: string | null
          to_session: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_integrity_audit: {
        Row: {
          issue: string | null
          reference_id: string | null
          severity: string | null
        }
        Relationships: []
      }
      v_invalid_attendance_consumption: {
        Row: {
          attendance_record_id: string | null
          attendance_status: string | null
          consumed_at: string | null
          consumption_id: string | null
          enrollment_id: string | null
          group_id: string | null
          invalidated_at: string | null
          invalidation_reason: string | null
          schedule_id: string | null
          schedule_status: string | null
          session_number: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_funding_status"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_without_eligible_contract"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_consumption_integrity"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_orphan_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_unmatched_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
        ]
      }
      v_invalid_package_consumption: {
        Row: {
          attendance_record_id: string | null
          attendance_status: string | null
          consumption_id: string | null
          enrollment_end: string | null
          enrollment_id: string | null
          enrollment_start: string | null
          invalidated_at: string | null
          session_date: string | null
          session_status: string | null
          student_id: string | null
          validity_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_funding_status"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_without_eligible_contract"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_consumption_integrity"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_orphan_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_unmatched_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
        ]
      }
      v_open_ended_groups: {
        Row: {
          branch_name: string | null
          completed_sessions: number | null
          group_id: string | null
          group_name: string | null
          status: string | null
        }
        Relationships: []
      }
      v_operations_alerts: {
        Row: {
          alert_type: string | null
          branch_id: string | null
          description: string | null
          entity_id: string | null
          entity_name: string | null
          severity: string | null
        }
        Relationships: []
      }
      v_orphan_attendance: {
        Row: {
          attendance_record_id: string | null
          group_name: string | null
          schedule_id: string | null
          session_date: string | null
          session_status: string | null
          status: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_orphan_attendance_consumption: {
        Row: {
          attendance_record_id: string | null
          consumed_at: string | null
          consumption_id: string | null
          enrollment_id: string | null
          orphan_reason: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_funding_status"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_without_eligible_contract"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_consumption_integrity"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_orphan_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_unmatched_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
        ]
      }
      v_orphan_sessions: {
        Row: {
          group_course_id: string | null
          group_id: string | null
          id: string | null
          scheduled_at: string | null
          session_number: number | null
          status: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
        ]
      }
      v_reconciliation_candidates: {
        Row: {
          earliest_unmatched: string | null
          eligible_enrollments: number | null
          latest_unmatched: string | null
          student_id: string | null
          unmatched_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_session_consumption_status: {
        Row: {
          consuming_records: number | null
          consumption_entries: number | null
          group_name: string | null
          schedule_id: string | null
          scheduled_at: string | null
          session_status: string | null
          topic: string | null
          total_records: number | null
          unlinked_consuming: number | null
        }
        Relationships: []
      }
      v_session_count_health: {
        Row: {
          actual_count: number | null
          drift: number | null
          group_id: string | null
          group_name: string | null
          group_status: string | null
          stored_count: number | null
        }
        Insert: {
          actual_count?: never
          drift?: never
          group_id?: string | null
          group_name?: string | null
          group_status?: string | null
          stored_count?: number | null
        }
        Update: {
          actual_count?: never
          drift?: never
          group_id?: string | null
          group_name?: string | null
          group_status?: string | null
          stored_count?: number | null
        }
        Relationships: []
      }
      v_sessions_missing_topics: {
        Row: {
          branch_id: string | null
          course_name: string | null
          created_at: string | null
          group_course_id: string | null
          group_name: string | null
          schedule_id: string | null
          scheduled_at: string | null
          status: string | null
          topic: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
        ]
      }
      v_sessions_without_number: {
        Row: {
          created_at: string | null
          group_course_id: string | null
          id: string | null
          scheduled_at: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          group_course_id?: string | null
          id?: string | null
          scheduled_at?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          group_course_id?: string | null
          id?: string | null
          scheduled_at?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "group_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_group_course_id_fkey"
            columns: ["group_course_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_course_id"]
          },
        ]
      }
      v_student_attendance_summary: {
        Row: {
          absent_count: number | null
          attendance_pct: number | null
          cancelled_count: number | null
          consumed_count: number | null
          excused_count: number | null
          late_count: number | null
          makeup_count: number | null
          present_count: number | null
          student_id: string | null
          total_records: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_contract_drift: {
        Row: {
          completion_pct: number | null
          consumed_ledger: number | null
          consumed_stored: number | null
          consumption_drift: number | null
          enrolled_sessions: number | null
          enrollment_id: string | null
          group_id: string | null
          is_renewal_ready: boolean | null
          status: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_course_history: {
        Row: {
          attendance_rate: number | null
          consumed_sessions: number | null
          course_id: string | null
          course_name: string | null
          enrolled_sessions: number | null
          enrollment_id: string | null
          enrollment_start: string | null
          enrollment_status: string | null
          first_session_date: string | null
          group_id: string | null
          group_name: string | null
          instructor_name: string | null
          last_session_date: string | null
          remaining_sessions: number | null
          student_id: string | null
          total_absent: number | null
          total_excused: number | null
          total_late: number | null
          total_makeup: number | null
          total_present: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "group_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["course_id"]
          },
        ]
      }
      v_student_dashboard_integrity: {
        Row: {
          active_enrollment_id: string | null
          consumed_sessions: number | null
          dashboard_status: string | null
          enrolled_sessions: number | null
          enrollment_start: string | null
          group_id: string | null
          group_membership_status: string | null
          remaining_sessions: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_history_health: {
        Row: {
          absent_count: number | null
          excused_count: number | null
          late_count: number | null
          ledger_entries: number | null
          makeup_count: number | null
          missing_ledger_entries: number | null
          present_count: number | null
          student_id: string | null
          total_attendance_records: number | null
          total_consumed_sessions: number | null
          total_enrolled_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_package_ledger: {
        Row: {
          attendance_record_id: string | null
          attendance_status: string | null
          consumed_at: string | null
          consumption_id: string | null
          course_id: string | null
          course_name: string | null
          enrolled_sessions: number | null
          enrollment_id: string | null
          enrollment_start: string | null
          enrollment_status: string | null
          group_id: string | null
          group_name: string | null
          instructor_name: string | null
          invalidated_at: string | null
          schedule_id: string | null
          session_date: string | null
          session_status: string | null
          student_id: string | null
          topic: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_funding_status"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_attendance_without_eligible_contract"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_consumption_integrity"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_orphan_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "v_unmatched_attendance"
            referencedColumns: ["attendance_record_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_contract_consumption_mismatch"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_academic_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_integrity"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_contract_drift"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_consumptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_dashboard_integrity"
            referencedColumns: ["active_enrollment_id"]
          },
        ]
      }
      v_student_risk: {
        Row: {
          assignment_score: number | null
          attendance_score: number | null
          branch_id: string | null
          current_group_id: string | null
          current_group_name: string | null
          days_since_attendance: number | null
          finance_status: string | null
          parent_phone: string | null
          remaining_balance: number | null
          remaining_sessions: number | null
          risk_score: number | null
          student_code: string | null
          student_id: string | null
          student_name: string | null
          student_phone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_group_attendance_mismatch"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_group_count_drift"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress_integrity"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_group_readiness"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_open_ended_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_session_count_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_student_course_history"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "student_course_progress_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_unmatched_attendance: {
        Row: {
          attendance_record_id: string | null
          branch_id: string | null
          branch_name_snapshot: string | null
          course_name_snapshot: string | null
          group_name_snapshot: string | null
          instructor_name_snapshot: string | null
          recorded_at: string | null
          schedule_id: string | null
          session_date: string | null
          status: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_cancelled_sessions_with_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_attendance_consumption"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_orphan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_session_consumption_status"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_missing_topics"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_without_number"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "v_student_package_ledger"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_finance_contract_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_risk"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_overview"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_financial_collection_health"
            referencedColumns: ["branch_id"]
          },
        ]
      }
    }
    Functions: {
      award_xp: {
        Args: {
          p_amount: number
          p_is_activity?: boolean
          p_student_id: string
        }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_total_xp: number
        }[]
      }
      cancel_schedule_with_cascade: {
        Args: { p_schedule_id: string }
        Returns: Json
      }
      check_invoice_overdue: { Args: never; Returns: undefined }
      consume_attendance_sessions_batch: {
        Args: {
          p_enrollment_ids: string[]
          p_record_ids: string[]
          p_student_ids: string[]
        }
        Returns: undefined
      }
      full_recompute_all_consumption: {
        Args: never
        Returns: {
          enrollment_id: string
          fixed: boolean
          new_consumed: number
          old_consumed: number
        }[]
      }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      increment_consumed_sessions_batch: {
        Args: { p_enrollment_ids: string[] }
        Returns: undefined
      }
      is_feature_enabled: {
        Args: { p_branch_id?: string; p_flag_name: string; p_user_id?: string }
        Returns: boolean
      }
      mark_broken_promises: { Args: never; Returns: undefined }
      mark_overdue_installments: { Args: never; Returns: undefined }
      next_certificate_number: { Args: never; Returns: string }
      recompute_group_completed_sessions: {
        Args: { p_group_id?: string }
        Returns: {
          changed: boolean
          group_id: string
          new_count: number
          old_count: number
        }[]
      }
      recompute_schedule_consumptions: {
        Args: { p_schedule_id: string }
        Returns: Json
      }
      recompute_session_consumption: {
        Args: { p_enrollment_id?: string }
        Returns: {
          enrollment_id: string
          fixed: boolean
          new_consumed: number
          old_consumed: number
        }[]
      }
      recompute_student_consumed_sessions: {
        Args: { p_student_id?: string }
        Returns: {
          changed: boolean
          enrollment_id: string
          new_count: number
          old_count: number
          student_id: string
        }[]
      }
      reconcile_all_session_counts: {
        Args: never
        Returns: {
          changed: boolean
          entity: string
          entity_id: string
          new_count: number
          old_count: number
        }[]
      }
      reconcile_all_unmatched_sql: {
        Args: never
        Returns: {
          sessions_matched: number
          student_id: string
        }[]
      }
      reconcile_cancelled_session_attendance: {
        Args: { p_dry_run?: boolean }
        Returns: {
          consumptions_reversed: number
          group_id: string
          records_found: number
          records_invalidated: number
          schedule_id: string
          schedule_status: string
        }[]
      }
      reconcile_student_attendance_sql: {
        Args: { p_student_id: string }
        Returns: {
          enrollment_id: string
          sessions_matched: number
        }[]
      }
      reconcile_student_consumption: {
        Args: { p_student_id: string }
        Returns: {
          enrollment_id: string
          fixed: boolean
          new_consumed: number
          old_consumed: number
        }[]
      }
      remove_student_consumption: {
        Args: { p_consumption_id: string; p_student_id: string }
        Returns: {
          message: string
          ok: boolean
        }[]
      }
      repair_student_portal_accounts: {
        Args: never
        Returns: {
          email: string
          has_account: boolean
          has_password: boolean
          status: string
          student_id: string
          student_name: string
        }[]
      }
      search_entities: {
        Args: {
          p_branch_id?: string
          p_limit?: number
          p_query: string
          p_types?: string[]
        }
        Returns: {
          branch_id: string
          entity_id: string
          entity_type: string
          primary_text: string
          rank: number
          secondary_text: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_enrollment_financial_status: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      sync_installment_paid_amount: {
        Args: { p_inst_id: string }
        Returns: undefined
      }
      user_has_permission: {
        Args: { p_branch_id?: string; p_permission: string; p_user_id: string }
        Returns: boolean
      }
      verify_deployment_requirements: {
        Args: never
        Returns: {
          check_name: string
          details: string
          passed: boolean
        }[]
      }
      write_audit_log: {
        Args: {
          p_action: string
          p_branch_id?: string
          p_entity_id?: string
          p_entity_type: string
          p_new_values?: Json
          p_old_values?: Json
          p_performed_by: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
