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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          application_ids: string[]
          created_at: string
          id: string
          is_bulk: boolean
          notes: string | null
          target_kind: string
          tutor_ids: string[]
        }
        Insert: {
          action: string
          actor_id: string
          application_ids?: string[]
          created_at?: string
          id?: string
          is_bulk?: boolean
          notes?: string | null
          target_kind?: string
          tutor_ids?: string[]
        }
        Update: {
          action?: string
          actor_id?: string
          application_ids?: string[]
          created_at?: string
          id?: string
          is_bulk?: boolean
          notes?: string | null
          target_kind?: string
          tutor_ids?: string[]
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          created_at: string
          feedback: string | null
          file_path: string | null
          grade: string | null
          graded_at: string | null
          id: string
          note: string | null
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          feedback?: string | null
          file_path?: string | null
          grade?: string | null
          graded_at?: string | null
          id?: string
          note?: string | null
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          file_path?: string | null
          grade?: string | null
          graded_at?: string | null
          id?: string
          note?: string | null
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          attachment_path: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          status: string
          student_id: string
          subject: string | null
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          status?: string
          student_id: string
          subject?: string | null
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          status?: string
          student_id?: string
          subject?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      canvas_timeline_deltas: {
        Row: {
          created_at: string
          delta_data: Json
          id: number
          session_id: string
          t_offset_ms: number
        }
        Insert: {
          created_at?: string
          delta_data: Json
          id?: number
          session_id: string
          t_offset_ms: number
        }
        Update: {
          created_at?: string
          delta_data?: Json
          id?: number
          session_id?: string
          t_offset_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_timeline_deltas_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whiteboard_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      child_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          child_email: string
          created_at: string
          expires_at: string
          id: string
          parent_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          child_email: string
          created_at?: string
          expires_at?: string
          id?: string
          parent_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          child_email?: string
          created_at?: string
          expires_at?: string
          id?: string
          parent_id?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      classroom_chat: {
        Row: {
          body: string
          created_at: string
          display_name: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          display_name: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          display_name?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          active_from: string
          active_to: string | null
          created_at: string
          fixed_cents: number | null
          id: string
          is_active: boolean
          method: string
          notes: string | null
          percent: number | null
          scope: string
          target_id: string | null
          target_text: string | null
          updated_at: string
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          fixed_cents?: number | null
          id?: string
          is_active?: boolean
          method: string
          notes?: string | null
          percent?: number | null
          scope: string
          target_id?: string | null
          target_text?: string | null
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          fixed_cents?: number | null
          id?: string
          is_active?: boolean
          method?: string
          notes?: string | null
          percent?: number | null
          scope?: string
          target_id?: string | null
          target_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      course_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "course_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      course_material_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          material_id: string
          student_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          material_id: string
          student_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          material_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_material_access_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "course_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      course_material_versions: {
        Row: {
          file_size: number | null
          id: string
          material_id: string
          mime_type: string | null
          notes: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          file_size?: number | null
          id?: string
          material_id: string
          mime_type?: string | null
          notes?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          file_size?: number | null
          id?: string
          material_id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_material_versions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "course_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          course_id: string
          created_at: string
          current_version: number
          description: string | null
          duration_sec: number | null
          external_url: string | null
          folder_id: string | null
          id: string
          kind: string
          storage_path: string | null
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          current_version?: number
          description?: string | null
          duration_sec?: number | null
          external_url?: string | null
          folder_id?: string | null
          id?: string
          kind?: string
          storage_path?: string | null
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          current_version?: number
          description?: string | null
          duration_sec?: number | null
          external_url?: string | null
          folder_id?: string | null
          id?: string
          kind?: string
          storage_path?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "tutor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_folder_fk"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "course_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          subject: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          subject?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          subject?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      help_messages: {
        Row: {
          body: string
          created_at: string
          email: string
          id: string
          name: string
          status: Database["public"]["Enums"]["help_status"]
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["help_status"]
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["help_status"]
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount_cents: number
          balance_type: string
          created_at: string
          currency: string
          description: string | null
          entry_type: string
          id: string
          metadata: Json
          payment_intent_id: string | null
          payout_item_id: string | null
          tutor_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          balance_type: string
          created_at?: string
          currency?: string
          description?: string | null
          entry_type: string
          id?: string
          metadata?: Json
          payment_intent_id?: string | null
          payout_item_id?: string | null
          tutor_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          balance_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          entry_type?: string
          id?: string
          metadata?: Json
          payment_intent_id?: string | null
          payout_item_id?: string | null
          tutor_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payout_item_id_fkey"
            columns: ["payout_item_id"]
            isOneToOne: false
            referencedRelation: "payout_items"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          ref_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_child_links: {
        Row: {
          child_id: string
          created_at: string
          id: string
          parent_id: string
          relationship: string | null
          status: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          parent_id: string
          relationship?: string | null
          status?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          parent_id?: string
          relationship?: string | null
          status?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          latency_ms: number | null
          payment_intent_id: string
          provider_ref: string | null
          provider_slug: string
          status: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          latency_ms?: number | null
          payment_intent_id: string
          provider_ref?: string | null
          provider_slug: string
          status: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          latency_ms?: number | null
          payment_intent_id?: string
          provider_ref?: string | null
          provider_slug?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          commission_cents: number
          created_at: string
          currency: string
          failure_reason: string | null
          gross_cents: number
          hold_until: string | null
          id: string
          metadata: Json
          method: string | null
          provider: string
          provider_ref: string | null
          refunded_at: string | null
          session_id: string | null
          status: string
          student_id: string
          succeeded_at: string | null
          tutor_id: string
          tutor_net_cents: number
          updated_at: string
        }
        Insert: {
          commission_cents?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gross_cents: number
          hold_until?: string | null
          id?: string
          metadata?: Json
          method?: string | null
          provider: string
          provider_ref?: string | null
          refunded_at?: string | null
          session_id?: string | null
          status?: string
          student_id: string
          succeeded_at?: string | null
          tutor_id: string
          tutor_net_cents?: number
          updated_at?: string
        }
        Update: {
          commission_cents?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gross_cents?: number
          hold_until?: string | null
          id?: string
          metadata?: Json
          method?: string | null
          provider?: string
          provider_ref?: string | null
          refunded_at?: string | null
          session_id?: string | null
          status?: string
          student_id?: string
          succeeded_at?: string | null
          tutor_id?: string
          tutor_net_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          details: Json
          display_label: string | null
          id: string
          is_default: boolean
          is_verified: boolean
          provider: string
          tutor_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          display_label?: string | null
          id?: string
          is_default?: boolean
          is_verified?: boolean
          provider: string
          tutor_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          display_label?: string | null
          id?: string
          is_default?: boolean
          is_verified?: boolean
          provider?: string
          tutor_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_providers: {
        Row: {
          config: Json
          created_at: string
          credentials_ref: string | null
          display_name: string
          failure_count: number
          id: string
          is_enabled: boolean
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          mode: string
          priority: number
          slug: string
          success_count: number
          supported_countries: string[]
          supported_currencies: string[]
          supported_methods: string[]
          supported_regions: Json
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials_ref?: string | null
          display_name: string
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          mode?: string
          priority?: number
          slug: string
          success_count?: number
          supported_countries?: string[]
          supported_currencies?: string[]
          supported_methods?: string[]
          supported_regions?: Json
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credentials_ref?: string | null
          display_name?: string
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          mode?: string
          priority?: number
          slug?: string
          success_count?: number
          supported_countries?: string[]
          supported_currencies?: string[]
          supported_methods?: string[]
          supported_regions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      payout_items: {
        Row: {
          commission_cents: number
          created_at: string
          currency: string
          failure_reason: string | null
          gross_cents: number
          id: string
          net_cents: number
          paid_at: string | null
          payment_method_id: string | null
          payout_run_id: string
          provider: string | null
          provider_transfer_ref: string | null
          status: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          commission_cents?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gross_cents?: number
          id?: string
          net_cents?: number
          paid_at?: string | null
          payment_method_id?: string | null
          payout_run_id: string
          provider?: string | null
          provider_transfer_ref?: string | null
          status?: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          commission_cents?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gross_cents?: number
          id?: string
          net_cents?: number
          paid_at?: string | null
          payment_method_id?: string | null
          payout_run_id?: string
          provider?: string | null
          provider_transfer_ref?: string | null
          status?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_payout_run_id_fkey"
            columns: ["payout_run_id"]
            isOneToOne: false
            referencedRelation: "payout_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          status: string
          total_commission_cents: number
          total_gross_cents: number
          total_net_cents: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: string
          total_commission_cents?: number
          total_gross_cents?: number
          total_net_cents?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_commission_cents?: number
          total_gross_cents?: number
          total_net_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          ai_enabled: boolean
          ai_token_limit_per_user: number
          classrooms_enabled: boolean
          id: number
          is_subscriptions_enabled: boolean
          payout_hold_hours: number
          updated_at: string
          updated_by: string | null
          whiteboard_export_enabled: boolean
          whiteboard_graphing_enabled: boolean
          whiteboard_latex_enabled: boolean
          whiteboard_ocr_enabled: boolean
        }
        Insert: {
          ai_enabled?: boolean
          ai_token_limit_per_user?: number
          classrooms_enabled?: boolean
          id?: number
          is_subscriptions_enabled?: boolean
          payout_hold_hours?: number
          updated_at?: string
          updated_by?: string | null
          whiteboard_export_enabled?: boolean
          whiteboard_graphing_enabled?: boolean
          whiteboard_latex_enabled?: boolean
          whiteboard_ocr_enabled?: boolean
        }
        Update: {
          ai_enabled?: boolean
          ai_token_limit_per_user?: number
          classrooms_enabled?: boolean
          id?: number
          is_subscriptions_enabled?: boolean
          payout_hold_hours?: number
          updated_at?: string
          updated_by?: string | null
          whiteboard_export_enabled?: boolean
          whiteboard_graphing_enabled?: boolean
          whiteboard_latex_enabled?: boolean
          whiteboard_ocr_enabled?: boolean
        }
        Relationships: []
      }
      prepaid_lessons: {
        Row: {
          created_at: string
          currency: string
          hourly_rate_cents: number
          id: string
          lesson_minutes: number
          lessons_remaining: number
          lessons_total: number
          payment_intent_id: string | null
          student_id: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          hourly_rate_cents: number
          id?: string
          lesson_minutes: number
          lessons_remaining: number
          lessons_total: number
          payment_intent_id?: string | null
          student_id: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          hourly_rate_cents?: number
          id?: string
          lesson_minutes?: number
          lessons_remaining?: number
          lessons_total?: number
          payment_intent_id?: string | null
          student_id?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaid_lessons_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability: Json | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          featured_until: string | null
          free_minutes_remaining: number
          full_name: string | null
          hourly_rate: number | null
          id: string
          is_featured: boolean
          phone: string | null
          subjects: string[] | null
          tutor_level: string
          updated_at: string
        }
        Insert: {
          availability?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          featured_until?: string | null
          free_minutes_remaining?: number
          full_name?: string | null
          hourly_rate?: number | null
          id: string
          is_featured?: boolean
          phone?: string | null
          subjects?: string[] | null
          tutor_level?: string
          updated_at?: string
        }
        Update: {
          availability?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          featured_until?: string | null
          free_minutes_remaining?: number
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          is_featured?: boolean
          phone?: string | null
          subjects?: string[] | null
          tutor_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tutor_level_fkey"
            columns: ["tutor_level"]
            isOneToOne: false
            referencedRelation: "tutor_levels"
            referencedColumns: ["slug"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          created_by: string
          discount_type: string
          expires_at: string | null
          id: string
          max_uses: number | null
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          created_by: string
          discount_type: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          created_by?: string
          discount_type?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      session_files: {
        Row: {
          created_at: string
          file_type: string | null
          filename: string
          id: string
          record_id: string
          room_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          filename: string
          id?: string
          record_id: string
          room_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_type?: string | null
          filename?: string
          id?: string
          record_id?: string
          room_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_files_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "session_records"
            referencedColumns: ["id"]
          },
        ]
      }
      session_records: {
        Row: {
          ai_summary: string | null
          chat_transcript: string | null
          created_at: string
          created_by: string
          id: string
          meeting_recording_url: string | null
          room_id: string
          session_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          chat_transcript?: string | null
          created_at?: string
          created_by: string
          id?: string
          meeting_recording_url?: string | null
          room_id: string
          session_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          chat_transcript?: string | null
          created_at?: string
          created_by?: string
          id?: string
          meeting_recording_url?: string | null
          room_id?: string
          session_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_recurrence: {
        Row: {
          created_at: string
          id: string
          parent_session_id: string
          rrule: string
          until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          parent_session_id: string
          rrule: string
          until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          parent_session_id?: string
          rrule?: string
          until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_recurrence_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_waitlist: {
        Row: {
          created_at: string
          desired_after: string | null
          desired_before: string | null
          duration_min: number
          id: string
          notes: string | null
          status: string
          student_id: string
          subject: string | null
          tutor_id: string
        }
        Insert: {
          created_at?: string
          desired_after?: string | null
          desired_before?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          status?: string
          student_id: string
          subject?: string | null
          tutor_id: string
        }
        Update: {
          created_at?: string
          desired_after?: string | null
          desired_before?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          subject?: string | null
          tutor_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          duration_min: number
          id: string
          is_free: boolean
          parent_session_id: string | null
          rescheduled_from: string | null
          room_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          subject: string | null
          tutor_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          is_free?: boolean
          parent_session_id?: string | null
          rescheduled_from?: string | null
          room_id?: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["session_status"]
          student_id: string
          subject?: string | null
          tutor_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          is_free?: boolean
          parent_session_id?: string | null
          rescheduled_from?: string | null
          room_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          student_id?: string
          subject?: string | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_assets: {
        Row: {
          asset_data: Json
          asset_type: string
          created_at: string
          id: string
          simulation_id: string
          user_id: string
        }
        Insert: {
          asset_data?: Json
          asset_type: string
          created_at?: string
          id?: string
          simulation_id: string
          user_id: string
        }
        Update: {
          asset_data?: Json
          asset_type?: string
          created_at?: string
          id?: string
          simulation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_assets_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_versions: {
        Row: {
          created_at: string
          id: string
          prompt: string
          schema_json: Json
          simulation_id: string
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          schema_json: Json
          simulation_id: string
          user_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          schema_json?: Json
          simulation_id?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_versions_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          ai_schema_version: number
          created_at: string
          embedding: string | null
          id: string
          processed: boolean
          prompt: string
          schema_json: Json
          subject: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_schema_version?: number
          created_at?: string
          embedding?: string | null
          id?: string
          processed?: boolean
          prompt: string
          schema_json: Json
          subject?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_schema_version?: number
          created_at?: string
          embedding?: string | null
          id?: string
          processed?: boolean
          prompt?: string
          schema_json?: Json
          subject?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          label: string
          multiline: boolean
          section: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          label: string
          multiline?: boolean
          section: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          key?: string
          label?: string
          multiline?: boolean
          section?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      student_subscriptions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["pay_method"]
          status: Database["public"]["Enums"]["sub_status"]
          student_id: string
          submitted_at: string
          transaction_ref: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["pay_method"]
          status?: Database["public"]["Enums"]["sub_status"]
          student_id: string
          submitted_at?: string
          transaction_ref: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"]
          status?: Database["public"]["Enums"]["sub_status"]
          student_id?: string
          submitted_at?: string
          transaction_ref?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["subject_level"]
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["subject_level"]
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["subject_level"]
          name?: string
        }
        Relationships: []
      }
      subscription_assignments: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          notes: string | null
          plan_id: string
          source: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          plan_id: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          plan_id?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          audience: string
          created_at: string
          currency: string
          description: string | null
          duration_count: number
          duration_unit: string
          feature_scope: string[]
          features: Json
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          audience: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_count?: number
          duration_unit?: string
          feature_scope?: string[]
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_count?: number
          duration_unit?: string
          feature_scope?: string[]
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tutor_application_documents: {
        Row: {
          application_id: string
          id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          id?: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "tutor_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_applications: {
        Row: {
          admin_notes: string | null
          bio: string
          email: string
          full_name: string
          id: string
          phone: string | null
          qualifications: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["tutor_application_status"]
          subjects: string[]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          bio: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          qualifications: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tutor_application_status"]
          subjects?: string[]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          bio?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          qualifications?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tutor_application_status"]
          subjects?: string[]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutor_availability: {
        Row: {
          buffer_minutes: number
          created_at: string
          end_min: number
          id: string
          start_min: number
          timezone: string
          tutor_id: string
          weekday: number
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          end_min: number
          id?: string
          start_min: number
          timezone?: string
          tutor_id: string
          weekday: number
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          end_min?: number
          id?: string
          start_min?: number
          timezone?: string
          tutor_id?: string
          weekday?: number
        }
        Relationships: []
      }
      tutor_courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["subject_level"]
          name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["course_status"]
          tutor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["subject_level"]
          name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          tutor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["subject_level"]
          name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          tutor_id?: string
        }
        Relationships: []
      }
      tutor_holidays: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          tutor_id?: string
        }
        Relationships: []
      }
      tutor_levels: {
        Row: {
          commission_percent: number
          created_at: string
          display_name: string
          id: string
          min_completed_sessions: number
          perks: Json
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          created_at?: string
          display_name: string
          id?: string
          min_completed_sessions?: number
          perks?: Json
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          created_at?: string
          display_name?: string
          id?: string
          min_completed_sessions?: number
          perks?: Json
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tutor_resources: {
        Row: {
          created_at: string
          id: string
          kind: string
          storage_path: string | null
          subject: string | null
          title: string
          tutor_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string | null
          subject?: string | null
          title: string
          tutor_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string | null
          subject?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      tutor_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          session_id: string | null
          student_id: string
          tutor_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          session_id?: string | null
          student_id: string
          tutor_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          session_id?: string | null
          student_id?: string
          tutor_id?: string
        }
        Relationships: []
      }
      tutor_subscriptions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["pay_method"]
          status: Database["public"]["Enums"]["sub_status"]
          submitted_at: string
          transaction_ref: string
          tutor_id: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["pay_method"]
          status?: Database["public"]["Enums"]["sub_status"]
          submitted_at?: string
          transaction_ref: string
          tutor_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"]
          status?: Database["public"]["Enums"]["sub_status"]
          submitted_at?: string
          transaction_ref?: string
          tutor_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whiteboard_mutations: {
        Row: {
          created_at: string
          id: string
          mutation_payload: Json
          mutation_type: string
          user_id: string
          whiteboard_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mutation_payload?: Json
          mutation_type: string
          user_id: string
          whiteboard_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mutation_payload?: Json
          mutation_type?: string
          user_id?: string
          whiteboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_mutations_whiteboard_id_fkey"
            columns: ["whiteboard_id"]
            isOneToOne: false
            referencedRelation: "whiteboards"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboard_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          room_id: string
          started_at: string
          started_by: string
          title: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          room_id: string
          started_at?: string
          started_by: string
          title?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          room_id?: string
          started_at?: string
          started_by?: string
          title?: string | null
        }
        Relationships: []
      }
      whiteboard_snapshots: {
        Row: {
          created_at: string
          id: string
          snapshot_data: Json
          whiteboard_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot_data: Json
          whiteboard_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snapshot_data?: Json
          whiteboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_snapshots_whiteboard_id_fkey"
            columns: ["whiteboard_id"]
            isOneToOne: false
            referencedRelation: "whiteboards"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboard_strokes: {
        Row: {
          created_at: string
          data: Json
          id: string
          page: number
          room_id: string
          stroke_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          page: number
          room_id: string
          stroke_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          page?: number
          room_id?: string
          stroke_id?: string
          user_id?: string
        }
        Relationships: []
      }
      whiteboards: {
        Row: {
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      forum_posts_public: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string | null
          id: string | null
          parent_id: string | null
          subject: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_child_invite: { Args: { _token: string }; Returns: string }
      admin_create_payout_run: {
        Args: { _period_end?: string; _period_start?: string }
        Returns: string
      }
      admin_mark_payout_item_failed: {
        Args: { _item: string; _reason: string }
        Returns: undefined
      }
      admin_mark_payout_item_paid: {
        Args: { _item: string; _provider_ref?: string }
        Returns: undefined
      }
      admin_record_manual_intent: {
        Args: {
          _currency?: string
          _gross_cents: number
          _method?: string
          _session?: string
          _student: string
          _subject?: string
          _tutor: string
        }
        Returns: string
      }
      admin_refund_intent: {
        Args: { _intent: string; _reason?: string }
        Returns: undefined
      }
      approve_tutor_application: {
        Args: { _application_id: string; _notes?: string }
        Returns: undefined
      }
      book_session: {
        Args: {
          _duration_min: number
          _is_free?: boolean
          _recurrence_weeks?: number
          _start: string
          _subject: string
          _tutor: string
        }
        Returns: string[]
      }
      booking_conflicts_check: {
        Args: { _duration_min: number; _start: string; _tutor: string }
        Returns: boolean
      }
      can_access_classroom_room: { Args: { _room: string }; Returns: boolean }
      cancel_session: {
        Args: { _reason?: string; _session: string }
        Returns: undefined
      }
      compute_commission_cents: {
        Args: { _amount_cents: number; _subject?: string; _tutor: string }
        Returns: number
      }
      confirm_bulk_lesson_intent: {
        Args: { _intent: string; _provider?: string; _provider_ref?: string }
        Returns: string
      }
      create_bulk_lesson_intent: {
        Args: {
          _lesson_minutes: number
          _lessons: number
          _method?: string
          _tutor: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_whiteboard: { Args: { _room_id: string }; Returns: string }
      finalize_payment_succeeded: {
        Args: { _intent: string; _provider: string; _provider_ref: string }
        Returns: undefined
      }
      get_my_scopes: { Args: never; Returns: string[] }
      get_session_participant_names: {
        Args: never
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_tutor_availability_public: {
        Args: { _tutor: string }
        Returns: {
          buffer_minutes: number
          end_min: number
          start_min: number
          timezone: string
          weekday: number
        }[]
      }
      get_tutor_busy_slots: {
        Args: { _from: string; _to: string; _tutor: string }
        Returns: {
          duration_min: number
          scheduled_at: string
        }[]
      }
      get_tutor_holidays_public: {
        Args: { _tutor: string }
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      get_tutor_pricing: {
        Args: { _tutor: string }
        Returns: {
          currency: string
          full_name: string
          hourly_rate: number
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_parent_of: { Args: { _child: string }; Returns: boolean }
      list_my_children: {
        Args: never
        Returns: {
          child_id: string
          full_name: string
          linked_at: string
          relationship: string
          status: string
        }[]
      }
      list_public_tutors: {
        Args: never
        Returns: {
          avatar_url: string
          avg_rating: number
          bio: string
          full_name: string
          hourly_rate: number
          id: string
          is_featured: boolean
          review_count: number
          session_count: number
          subjects: string[]
        }[]
      }
      list_students_for_tutor: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      log_tutor_decision: {
        Args: { _action: string; _application_ids: string[]; _notes?: string }
        Returns: string
      }
      mark_payment_failed: {
        Args: { _intent: string; _reason: string }
        Returns: undefined
      }
      match_simulations: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          created_at: string
          id: string
          prompt: string
          schema_json: Json
          similarity: number
          subject: string
          thumbnail_url: string
          title: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      payments_admin_overview: {
        Args: never
        Returns: {
          failed_transfers: number
          pending_payout_cents: number
          refunded_cents: number
          succeeded_count: number
          total_revenue_cents: number
          total_volume_cents: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_payment_attempt: {
        Args: {
          _failure_reason?: string
          _intent: string
          _latency_ms?: number
          _provider: string
          _provider_ref?: string
          _status: string
        }
        Returns: string
      }
      reject_tutor_application: {
        Args: { _application_id: string; _notes?: string }
        Returns: undefined
      }
      reschedule_session: {
        Args: { _new_start: string; _session: string }
        Returns: undefined
      }
      student_has_scope: { Args: { _scope: string }; Returns: boolean }
      tutor_balance: {
        Args: { _tutor: string }
        Returns: {
          earned_cents: number
          paid_out_cents: number
          payable_cents: number
          pending_cents: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "tutor" | "student" | "parent"
      course_status: "pending" | "approved" | "rejected"
      help_status: "open" | "answered" | "closed"
      pay_method: "mpesa" | "ecocash"
      session_status: "scheduled" | "live" | "completed" | "cancelled"
      sub_status: "pending" | "approved" | "rejected"
      subject_level: "primary" | "high_school" | "tertiary"
      tutor_application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "needs_info"
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
    Enums: {
      app_role: ["admin", "tutor", "student", "parent"],
      course_status: ["pending", "approved", "rejected"],
      help_status: ["open", "answered", "closed"],
      pay_method: ["mpesa", "ecocash"],
      session_status: ["scheduled", "live", "completed", "cancelled"],
      sub_status: ["pending", "approved", "rejected"],
      subject_level: ["primary", "high_school", "tertiary"],
      tutor_application_status: [
        "pending",
        "approved",
        "rejected",
        "needs_info",
      ],
    },
  },
} as const
