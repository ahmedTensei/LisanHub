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
      activity_days: {
        Row: {
          day: string
          user_id: string
        }
        Insert: {
          day: string
          user_id: string
        }
        Update: {
          day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ranks: {
        Row: {
          granted_at: string
          granted_by: string | null
          rank: Database["public"]["Enums"]["admin_rank"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          rank: Database["public"]["Enums"]["admin_rank"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          rank?: Database["public"]["Enums"]["admin_rank"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_ranks_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_ranks_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_ranks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_ranks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          hidden: boolean
          id: number
          linked_item_id: string | null
          pinned: boolean
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          hidden?: boolean
          id?: never
          linked_item_id?: string | null
          pinned?: boolean
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          hidden?: boolean
          id?: never
          linked_item_id?: string | null
          pinned?: boolean
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_linked_item_id_fkey"
            columns: ["linked_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          slug: string
          source_lang: string | null
          target_lang: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          source_lang?: string | null
          target_lang?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          source_lang?: string | null
          target_lang?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_source_lang_fkey"
            columns: ["source_lang"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "chat_rooms_target_lang_fkey"
            columns: ["target_lang"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      conduct_reports: {
        Row: {
          context: string
          created_at: string
          id: string
          message: string
          reported_user_id: string
          reporter_id: string
          room_id: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          context: string
          created_at?: string
          id?: string
          message: string
          reported_user_id: string
          reporter_id: string
          room_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          context?: string
          created_at?: string
          id?: string
          message?: string
          reported_user_id?: string
          reporter_id?: string
          room_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "conduct_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conduct_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conduct_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conduct_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          cefr_level: Database["public"]["Enums"]["cefr_level"] | null
          cefr_sublevel: number | null
          created_at: string
          current_version_id: string | null
          derived_from_version_id: string | null
          dialect_tag: string | null
          id: string
          is_paid: boolean
          kind: Database["public"]["Enums"]["content_kind"]
          license: string | null
          maintenance_paused: boolean
          owner_id: string
          provenance: Json | null
          published_at: string | null
          quality_label: Database["public"]["Enums"]["quality_label"]
          root_item_id: string | null
          search: unknown
          skills: Database["public"]["Enums"]["language_skill"][]
          source_lang: string
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          tags: string[]
          target_lang: string
          title: string
          updated_at: string
        }
        Insert: {
          cefr_level?: Database["public"]["Enums"]["cefr_level"] | null
          cefr_sublevel?: number | null
          created_at?: string
          current_version_id?: string | null
          derived_from_version_id?: string | null
          dialect_tag?: string | null
          id?: string
          is_paid?: boolean
          kind: Database["public"]["Enums"]["content_kind"]
          license?: string | null
          maintenance_paused?: boolean
          owner_id: string
          provenance?: Json | null
          published_at?: string | null
          quality_label?: Database["public"]["Enums"]["quality_label"]
          root_item_id?: string | null
          search?: unknown
          skills?: Database["public"]["Enums"]["language_skill"][]
          source_lang: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          tags?: string[]
          target_lang: string
          title: string
          updated_at?: string
        }
        Update: {
          cefr_level?: Database["public"]["Enums"]["cefr_level"] | null
          cefr_sublevel?: number | null
          created_at?: string
          current_version_id?: string | null
          derived_from_version_id?: string | null
          dialect_tag?: string | null
          id?: string
          is_paid?: boolean
          kind?: Database["public"]["Enums"]["content_kind"]
          license?: string | null
          maintenance_paused?: boolean
          owner_id?: string
          provenance?: Json | null
          published_at?: string | null
          quality_label?: Database["public"]["Enums"]["quality_label"]
          root_item_id?: string | null
          search?: unknown
          skills?: Database["public"]["Enums"]["language_skill"][]
          source_lang?: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          tags?: string[]
          target_lang?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_derived_from_version_fk"
            columns: ["derived_from_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_root_item_id_fkey"
            columns: ["root_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_source_lang_fkey"
            columns: ["source_lang"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "content_items_target_lang_fkey"
            columns: ["target_lang"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      content_versions: {
        Row: {
          author_id: string
          body: Json
          change_note: string | null
          created_at: string
          id: string
          item_id: string
          schema_version: number
          version_number: number
        }
        Insert: {
          author_id: string
          body: Json
          change_note?: string | null
          created_at?: string
          id?: string
          item_id: string
          schema_version?: number
          version_number: number
        }
        Update: {
          author_id?: string
          body?: Json
          change_note?: string | null
          created_at?: string
          id?: string
          item_id?: string
          schema_version?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          course_id: string
          lesson_id: string
          position: number
        }
        Insert: {
          course_id: string
          lesson_id: string
          position: number
        }
        Update: {
          course_id?: string
          lesson_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          key: string
          message: Json
          mode: Database["public"]["Enums"]["feature_mode"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          message?: Json
          mode?: Database["public"]["Enums"]["feature_mode"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          message?: Json
          mode?: Database["public"]["Enums"]["feature_mode"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          anchor: Json | null
          body: string
          created_at: string
          from_user_id: string
          id: string
          item_id: string
          state: string
        }
        Insert: {
          anchor?: Json | null
          body: string
          created_at?: string
          from_user_id: string
          id?: string
          item_id: string
          state?: string
        }
        Update: {
          anchor?: Json | null
          body?: string
          created_at?: string
          from_user_id?: string
          id?: string
          item_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      language_pairs: {
        Row: {
          created_at: string
          dialect_tag: string | null
          goal: string | null
          id: string
          native_lang: string
          target_lang: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dialect_tag?: string | null
          goal?: string | null
          id?: string
          native_lang: string
          target_lang: string
          user_id: string
        }
        Update: {
          created_at?: string
          dialect_tag?: string | null
          goal?: string | null
          id?: string
          native_lang?: string
          target_lang?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "language_pairs_native_lang_fkey"
            columns: ["native_lang"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "language_pairs_target_lang_fkey"
            columns: ["target_lang"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "language_pairs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "language_pairs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          direction: string
          iso639_1: string | null
          lang_type: string
          name_en: string
          scope: string
        }
        Insert: {
          code: string
          created_at?: string
          direction?: string
          iso639_1?: string | null
          lang_type?: string
          name_en: string
          scope?: string
        }
        Update: {
          code?: string
          created_at?: string
          direction?: string
          iso639_1?: string | null
          lang_type?: string
          name_en?: string
          scope?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: number
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feedback: {
        Row: {
          app_version: string | null
          category: string
          created_at: string
          id: string
          message: string | null
          page_path: string | null
          score: number | null
          status: string
          ui_locale: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string | null
          page_path?: string | null
          score?: number | null
          status?: string
          ui_locale?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string | null
          page_path?: string | null
          score?: number | null
          status?: string
          ui_locale?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          is_founding_member: boolean
          location: string | null
          primary_role: Database["public"]["Enums"]["primary_role"]
          ui_locale: string
          updated_at: string
          username: string
          visibility: Database["public"]["Enums"]["profile_visibility"]
        }
        Insert: {
          avatar_key?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          is_founding_member?: boolean
          location?: string | null
          primary_role?: Database["public"]["Enums"]["primary_role"]
          ui_locale?: string
          updated_at?: string
          username: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Update: {
          avatar_key?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_founding_member?: boolean
          location?: string | null
          primary_role?: Database["public"]["Enums"]["primary_role"]
          ui_locale?: string
          updated_at?: string
          username?: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Relationships: []
      }
      progress: {
        Row: {
          completed_at: string | null
          item_id: string
          last_block_id: string | null
          score: number | null
          state: Database["public"]["Enums"]["progress_state"]
          updated_at: string
          user_id: string
          version_id: string | null
        }
        Insert: {
          completed_at?: string | null
          item_id: string
          last_block_id?: string | null
          score?: number | null
          state?: Database["public"]["Enums"]["progress_state"]
          updated_at?: string
          user_id: string
          version_id?: string | null
        }
        Update: {
          completed_at?: string | null
          item_id?: string
          last_block_id?: string | null
          score?: number | null
          state?: Database["public"]["Enums"]["progress_state"]
          updated_at?: string
          user_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          created_at: string
          item_id: string
          owner_reply: string | null
          review: string | null
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          owner_reply?: string | null
          review?: string | null
          stars: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          owner_reply?: string | null
          review?: string | null
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          anchor: Json | null
          created_at: string
          id: string
          item_id: string
          message: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          version_id: string | null
        }
        Insert: {
          anchor?: Json | null
          created_at?: string
          id?: string
          item_id: string
          message?: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          version_id?: string | null
        }
        Update: {
          anchor?: Json | null
          created_at?: string
          id?: string
          item_id?: string
          message?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_states: {
        Row: {
          card_key: string
          difficulty: number
          due: string
          item_id: string | null
          lapses: number
          last_review: string | null
          learning_steps: number
          reps: number
          scheduled_days: number
          stability: number
          state: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_key: string
          difficulty?: number
          due: string
          item_id?: string | null
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_key?: string
          difficulty?: number
          due?: string
          item_id?: string | null
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_states_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          created_at: string
          handled_by: string | null
          id: string
          kind: Database["public"]["Enums"]["support_request_kind"]
          message: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handled_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["support_request_kind"]
          message?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handled_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["support_request_kind"]
          message?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          mute_only: boolean
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          mute_only?: boolean
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          mute_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profile_cards: {
        Row: {
          avatar_key: string | null
          display_name: string | null
          id: string | null
          is_founding_member: boolean | null
          primary_role: Database["public"]["Enums"]["primary_role"] | null
          username: string | null
        }
        Insert: {
          avatar_key?: string | null
          display_name?: string | null
          id?: string | null
          is_founding_member?: boolean | null
          primary_role?: Database["public"]["Enums"]["primary_role"] | null
          username?: string | null
        }
        Update: {
          avatar_key?: string | null
          display_name?: string | null
          id?: string | null
          is_founding_member?: boolean | null
          primary_role?: Database["public"]["Enums"]["primary_role"] | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_rank_level: {
        Args: { r: Database["public"]["Enums"]["admin_rank"] }
        Returns: number
      }
      admin_set_primary_role: {
        Args: {
          p_role: Database["public"]["Enums"]["primary_role"]
          p_user: string
        }
        Returns: Database["public"]["Enums"]["primary_role"]
      }
      admin_set_rank: {
        Args: {
          p_rank: Database["public"]["Enums"]["admin_rank"]
          p_user: string
        }
        Returns: Database["public"]["Enums"]["admin_rank"]
      }
      become_content_creator: {
        Args: never
        Returns: Database["public"]["Enums"]["primary_role"]
      }
      current_admin_level: { Args: never; Returns: number }
      current_primary_role: {
        Args: never
        Returns: Database["public"]["Enums"]["primary_role"]
      }
      is_moderator: { Args: never; Returns: boolean }
      published_version_number: { Args: { p_item: string }; Returns: number }
      resolve_support_request: {
        Args: {
          p_note?: string
          p_request: string
          p_status: Database["public"]["Enums"]["support_request_status"]
        }
        Returns: Database["public"]["Enums"]["support_request_status"]
      }
      search_languages: {
        Args: { max_results?: number; q: string }
        Returns: {
          code: string
          direction: string
          iso639_1: string
          name_en: string
        }[]
      }
      setting_int: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      storage_object_owner: { Args: { object_name: string }; Returns: string }
      username_available: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      admin_rank:
        | "moderator"
        | "administrator"
        | "super_administrator"
        | "platform_owner"
      cefr_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      content_kind: "course" | "lesson" | "deck"
      content_status: "draft" | "published" | "archived" | "hidden" | "removed"
      feature_mode: "enabled" | "create_disabled" | "read_only" | "disabled"
      language_skill: "listening" | "reading" | "pronunciation" | "writing"
      primary_role: "student" | "content_creator" | "contributor"
      profile_visibility: "public" | "restricted"
      progress_state: "not_started" | "in_progress" | "completed"
      quality_label:
        | "founding_team_reviewed"
        | "new_community_content"
        | "community_trusted"
      report_status:
        | "open"
        | "acknowledged"
        | "resolved"
        | "dismissed"
        | "escalated"
      report_type: "error" | "violation" | "outdated_expression" | "copyright"
      support_request_kind: "revert_to_student" | "other"
      support_request_status: "open" | "in_review" | "resolved" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      admin_rank: [
        "moderator",
        "administrator",
        "super_administrator",
        "platform_owner",
      ],
      cefr_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
      content_kind: ["course", "lesson", "deck"],
      content_status: ["draft", "published", "archived", "hidden", "removed"],
      feature_mode: ["enabled", "create_disabled", "read_only", "disabled"],
      language_skill: ["listening", "reading", "pronunciation", "writing"],
      primary_role: ["student", "content_creator", "contributor"],
      profile_visibility: ["public", "restricted"],
      progress_state: ["not_started", "in_progress", "completed"],
      quality_label: [
        "founding_team_reviewed",
        "new_community_content",
        "community_trusted",
      ],
      report_status: [
        "open",
        "acknowledged",
        "resolved",
        "dismissed",
        "escalated",
      ],
      report_type: ["error", "violation", "outdated_expression", "copyright"],
      support_request_kind: ["revert_to_student", "other"],
      support_request_status: ["open", "in_review", "resolved", "rejected"],
    },
  },
} as const
