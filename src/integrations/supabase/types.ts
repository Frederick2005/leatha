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
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          device_type: string | null
          event_data: Json
          event_type: string
          id: string
          metadata: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          event_data?: Json
          event_type: string
          id?: string
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          author_id: string
          body: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          audience?: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          audience?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          currency: string
          ends_at: string
          id: string
          notes: string | null
          price_cents: number
          starts_at: string
          status: string
          student_id: string
          subject: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          ends_at: string
          id?: string
          notes?: string | null
          price_cents?: number
          starts_at: string
          status?: string
          student_id: string
          subject: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          ends_at?: string
          id?: string
          notes?: string | null
          price_cents?: number
          starts_at?: string
          status?: string
          student_id?: string
          subject?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      arena_attempts: {
        Row: {
          challenge_id: string
          completed_at: string | null
          created_at: string
          hints_used: number
          id: string
          memory_kb: number | null
          runtime_ms: number | null
          score: number
          status: Database["public"]["Enums"]["arena_attempt_status"]
          submitted_answer: Json | null
          submitted_code: string | null
          tests_passed: number
          tests_total: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          hints_used?: number
          id?: string
          memory_kb?: number | null
          runtime_ms?: number | null
          score?: number
          status?: Database["public"]["Enums"]["arena_attempt_status"]
          submitted_answer?: Json | null
          submitted_code?: string | null
          tests_passed?: number
          tests_total?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          hints_used?: number
          id?: string
          memory_kb?: number | null
          runtime_ms?: number | null
          score?: number
          status?: Database["public"]["Enums"]["arena_attempt_status"]
          submitted_answer?: Json | null
          submitted_code?: string | null
          tests_passed?: number
          tests_total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_battle_participants: {
        Row: {
          battle_id: string
          id: string
          joined_at: string
          score: number
          status: string
          team: string | null
          user_id: string
        }
        Insert: {
          battle_id: string
          id?: string
          joined_at?: string
          score?: number
          status?: string
          team?: string | null
          user_id: string
        }
        Update: {
          battle_id?: string
          id?: string
          joined_at?: string
          score?: number
          status?: string
          team?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_battle_participants_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "arena_battles"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_battles: {
        Row: {
          challenge_id: string | null
          created_at: string
          duration_seconds: number
          ends_at: string | null
          host_id: string
          id: string
          mode: Database["public"]["Enums"]["arena_battle_mode"]
          school_id: string | null
          starts_at: string | null
          state: Database["public"]["Enums"]["arena_battle_state"]
          winner_id: string | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          duration_seconds?: number
          ends_at?: string | null
          host_id: string
          id?: string
          mode?: Database["public"]["Enums"]["arena_battle_mode"]
          school_id?: string | null
          starts_at?: string | null
          state?: Database["public"]["Enums"]["arena_battle_state"]
          winner_id?: string | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          duration_seconds?: number
          ends_at?: string | null
          host_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["arena_battle_mode"]
          school_id?: string | null
          starts_at?: string | null
          state?: Database["public"]["Enums"]["arena_battle_state"]
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_battles_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_challenge_questions: {
        Row: {
          challenge_id: string
          correct_indexes: number[]
          created_at: string
          explanation: string | null
          id: string
          options: Json
          position: number
          prompt: string
        }
        Insert: {
          challenge_id: string
          correct_indexes?: number[]
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          position?: number
          prompt: string
        }
        Update: {
          challenge_id?: string
          correct_indexes?: number[]
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_challenge_questions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_challenges: {
        Row: {
          attempt_count: number
          avg_rating: number
          coin_reward: number
          created_at: string
          creator_id: string
          description: string
          difficulty: Database["public"]["Enums"]["arena_difficulty"]
          estimated_minutes: number
          hidden_test_cases: Json
          id: string
          language: string | null
          linked_lesson_id: string | null
          points_reward: number
          slug: string
          solve_count: number
          starter_code: string | null
          status: Database["public"]["Enums"]["arena_challenge_status"]
          tags: string[]
          test_cases: Json
          title: string
          type: Database["public"]["Enums"]["arena_challenge_type"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          avg_rating?: number
          coin_reward?: number
          created_at?: string
          creator_id: string
          description?: string
          difficulty?: Database["public"]["Enums"]["arena_difficulty"]
          estimated_minutes?: number
          hidden_test_cases?: Json
          id?: string
          language?: string | null
          linked_lesson_id?: string | null
          points_reward?: number
          slug: string
          solve_count?: number
          starter_code?: string | null
          status?: Database["public"]["Enums"]["arena_challenge_status"]
          tags?: string[]
          test_cases?: Json
          title: string
          type: Database["public"]["Enums"]["arena_challenge_type"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          avg_rating?: number
          coin_reward?: number
          created_at?: string
          creator_id?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["arena_difficulty"]
          estimated_minutes?: number
          hidden_test_cases?: Json
          id?: string
          language?: string | null
          linked_lesson_id?: string | null
          points_reward?: number
          slug?: string
          solve_count?: number
          starter_code?: string | null
          status?: Database["public"]["Enums"]["arena_challenge_status"]
          tags?: string[]
          test_cases?: Json
          title?: string
          type?: Database["public"]["Enums"]["arena_challenge_type"]
          updated_at?: string
        }
        Relationships: []
      }
      arena_comments: {
        Row: {
          author_id: string
          body: string
          challenge_id: string
          created_at: string
          id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          challenge_id: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          challenge_id?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_comments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "arena_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_daily_challenges: {
        Row: {
          bonus_points: number
          challenge_id: string
          created_at: string
          for_date: string
          id: string
        }
        Insert: {
          bonus_points?: number
          challenge_id: string
          created_at?: string
          for_date: string
          id?: string
        }
        Update: {
          bonus_points?: number
          challenge_id?: string
          created_at?: string
          for_date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_daily_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_hints: {
        Row: {
          body: string
          challenge_id: string
          created_at: string
          id: string
          point_penalty: number
          position: number
        }
        Insert: {
          body: string
          challenge_id: string
          created_at?: string
          id?: string
          point_penalty?: number
          position?: number
        }
        Update: {
          body?: string
          challenge_id?: string
          created_at?: string
          id?: string
          point_penalty?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_hints_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_profiles: {
        Row: {
          coins: number
          created_at: string
          last_active: string | null
          longest_streak: number
          multiplier: number
          rank: string
          reputation: number
          shields: number
          streak: number
          total_attempts: number
          total_solves: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          coins?: number
          created_at?: string
          last_active?: string | null
          longest_streak?: number
          multiplier?: number
          rank?: string
          reputation?: number
          shields?: number
          streak?: number
          total_attempts?: number
          total_solves?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          coins?: number
          created_at?: string
          last_active?: string | null
          longest_streak?: number
          multiplier?: number
          rank?: string
          reputation?: number
          shields?: number
          streak?: number
          total_attempts?: number
          total_solves?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      arena_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      arena_replays: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          timeline: Json
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          timeline?: Json
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          timeline?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_replays_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "arena_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          rarity: Database["public"]["Enums"]["arena_reward_rarity"]
          reason: string | null
          related_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          kind: string
          rarity?: Database["public"]["Enums"]["arena_reward_rarity"]
          reason?: string | null
          related_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          rarity?: Database["public"]["Enums"]["arena_reward_rarity"]
          reason?: string | null
          related_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      arena_school_rankings: {
        Row: {
          id: string
          rank: number | null
          school_id: string
          score: number
          season_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          rank?: number | null
          school_id: string
          score?: number
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          rank?: number | null
          school_id?: string
          score?: number
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_school_rankings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "arena_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_seasons: {
        Row: {
          cover_url: string | null
          created_at: string
          ends_at: string
          id: string
          name: string
          starts_at: string
          theme: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          ends_at: string
          id?: string
          name: string
          starts_at: string
          theme?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
          theme?: string | null
        }
        Relationships: []
      }
      arena_shared_solutions: {
        Row: {
          author_id: string
          body: string
          challenge_id: string
          created_at: string
          id: string
          language: string | null
          title: string
          upvotes: number
        }
        Insert: {
          author_id: string
          body?: string
          challenge_id: string
          created_at?: string
          id?: string
          language?: string | null
          title?: string
          upvotes?: number
        }
        Update: {
          author_id?: string
          body?: string
          challenge_id?: string
          created_at?: string
          id?: string
          language?: string | null
          title?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_shared_solutions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_teacher_insights: {
        Row: {
          challenge_id: string | null
          computed_at: string
          id: string
          metric: string
          teacher_id: string
          value: Json
        }
        Insert: {
          challenge_id?: string | null
          computed_at?: string
          id?: string
          metric: string
          teacher_id: string
          value?: Json
        }
        Update: {
          challenge_id?: string | null
          computed_at?: string
          id?: string
          metric?: string
          teacher_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "arena_teacher_insights_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_titles: {
        Row: {
          description: string | null
          earned_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          description?: string | null
          earned_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          description?: string | null
          earned_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          host_id: string
          id: string
          max_participants: number | null
          room_name: string
          room_type: string
          scheduled_for: string | null
          started_at: string | null
          status: string
          title: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          host_id: string
          id?: string
          max_participants?: number | null
          room_name: string
          room_type: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          host_id?: string
          id?: string
          max_participants?: number | null
          room_name?: string
          room_type?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      class_assignments: {
        Row: {
          class_id: string
          created_at: string
          due_at: string | null
          id: string
          lesson_id: string | null
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          lesson_id?: string | null
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          lesson_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      class_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_memberships: {
        Row: {
          class_id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_memberships_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          lesson_id: string
          parent_comment_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          lesson_id: string
          parent_comment_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          lesson_id?: string
          parent_comment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_options: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          usage_count: number
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          usage_count?: number
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          usage_count?: number
          value?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_path: string
          file_size_bytes: number
          file_type: string | null
          file_url: string
          id: string
          owner_id: string
          subject: string | null
          title: string
          visibility: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size_bytes?: number
          file_type?: string | null
          file_url: string
          id?: string
          owner_id: string
          subject?: string | null
          title: string
          visibility?: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size_bytes?: number
          file_type?: string | null
          file_url?: string
          id?: string
          owner_id?: string
          subject?: string | null
          title?: string
          visibility?: string
        }
        Relationships: []
      }
      endorsements: {
        Row: {
          body: string
          created_at: string
          id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_notes: string | null
          body: string
          category: string
          created_at: string
          id: string
          priority: boolean
          rating: number | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          body: string
          category?: string
          created_at?: string
          id?: string
          priority?: boolean
          rating?: number | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          priority?: boolean
          rating?: number | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      lesson_contributors: {
        Row: {
          created_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_contributors_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_contributors_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_likes: {
        Row: {
          created_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_likes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_suggestions: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          description: string
          id: string
          lesson_id: string | null
          status: string
          subject: string
          suggested_by: string
          title: string
          updated_at: string
          upvote_count: number
          view_count: number
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          description: string
          id?: string
          lesson_id?: string | null
          status?: string
          subject: string
          suggested_by: string
          title: string
          updated_at?: string
          upvote_count?: number
          view_count?: number
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          description?: string
          id?: string
          lesson_id?: string | null
          status?: string
          subject?: string
          suggested_by?: string
          title?: string
          updated_at?: string
          upvote_count?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_suggestions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_views: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          scroll_depth_percent: number
          time_spent_seconds: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          scroll_depth_percent?: number
          time_spent_seconds?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          scroll_depth_percent?: number
          time_spent_seconds?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_views_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          attachments: Json
          author_id: string
          comment_count: number
          content: string
          content_type: string
          created_at: string
          document_type: string | null
          document_url: string | null
          fork_count: number
          id: string
          is_published: boolean
          language: string | null
          like_count: number
          parent_lesson_id: string | null
          root_lesson_id: string | null
          slug: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          video_url: string | null
          view_count: number
        }
        Insert: {
          attachments?: Json
          author_id: string
          comment_count?: number
          content?: string
          content_type?: string
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          fork_count?: number
          id?: string
          is_published?: boolean
          language?: string | null
          like_count?: number
          parent_lesson_id?: string | null
          root_lesson_id?: string | null
          slug: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Update: {
          attachments?: Json
          author_id?: string
          comment_count?: number
          content?: string
          content_type?: string
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          fork_count?: number
          id?: string
          is_published?: boolean
          language?: string | null
          like_count?: number
          parent_lesson_id?: string | null
          root_lesson_id?: string | null
          slug?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_parent_lesson_id_fkey"
            columns: ["parent_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_root_lesson_id_fkey"
            columns: ["root_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          related_id: string | null
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
          related_id?: string | null
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
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          created_at: string
          currency: string
          id: string
          payee_id: string
          payer_id: string
          phone_number: string
          provider: string
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payee_id: string
          payer_id: string
          phone_number: string
          provider: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payee_id?: string
          payer_id?: string
          phone_number?: string
          provider?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          bio: string | null
          career_goal: string | null
          certifications: string[]
          cover_url: string | null
          created_at: string
          dark_mode: boolean
          display_name: string | null
          experience: string | null
          follower_count: number
          following_count: number
          fork_received_count: number
          grade: string | null
          has_completed_onboarding: boolean
          id: string
          interests: string[]
          intro_video_url: string | null
          is_verified: boolean
          last_active_at: string
          learning_goals: string | null
          learning_style: string | null
          lesson_count: number
          level: number
          location: string | null
          points: number
          preferred_subjects: string[]
          school: string | null
          skill_level: string | null
          streak_days: number
          study_goal: string | null
          subjects: string[]
          teaching_philosophy: string | null
          theme: string
          updated_at: string
          username: string
          weekly_challenge_target: number
          weekly_lesson_target: number
          xp: number
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          career_goal?: string | null
          certifications?: string[]
          cover_url?: string | null
          created_at?: string
          dark_mode?: boolean
          display_name?: string | null
          experience?: string | null
          follower_count?: number
          following_count?: number
          fork_received_count?: number
          grade?: string | null
          has_completed_onboarding?: boolean
          id: string
          interests?: string[]
          intro_video_url?: string | null
          is_verified?: boolean
          last_active_at?: string
          learning_goals?: string | null
          learning_style?: string | null
          lesson_count?: number
          level?: number
          location?: string | null
          points?: number
          preferred_subjects?: string[]
          school?: string | null
          skill_level?: string | null
          streak_days?: number
          study_goal?: string | null
          subjects?: string[]
          teaching_philosophy?: string | null
          theme?: string
          updated_at?: string
          username: string
          weekly_challenge_target?: number
          weekly_lesson_target?: number
          xp?: number
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          career_goal?: string | null
          certifications?: string[]
          cover_url?: string | null
          created_at?: string
          dark_mode?: boolean
          display_name?: string | null
          experience?: string | null
          follower_count?: number
          following_count?: number
          fork_received_count?: number
          grade?: string | null
          has_completed_onboarding?: boolean
          id?: string
          interests?: string[]
          intro_video_url?: string | null
          is_verified?: boolean
          last_active_at?: string
          learning_goals?: string | null
          learning_style?: string | null
          lesson_count?: number
          level?: number
          location?: string | null
          points?: number
          preferred_subjects?: string[]
          school?: string | null
          skill_level?: string | null
          streak_days?: number
          study_goal?: string | null
          subjects?: string[]
          teaching_philosophy?: string | null
          theme?: string
          updated_at?: string
          username?: string
          weekly_challenge_target?: number
          weekly_lesson_target?: number
          xp?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_by: string
          resolution_note: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_by: string
          resolution_note?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_by?: string
          resolution_note?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
          updated_at?: string
        }
        Relationships: []
      }
      rewards_log: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          related_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          related_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          related_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          admin_id: string
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          admin_id: string
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          admin_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      suggestion_upvotes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_upvotes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "lesson_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_views: {
        Row: {
          id: string
          suggestion_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          suggestion_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          suggestion_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_views_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "lesson_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      teacher_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          teacher_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          teacher_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          teacher_id?: string
          weekday?: number
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          accepts_bookings: boolean
          bio_long: string | null
          created_at: string
          currency: string
          hourly_rate_cents: number
          rating_avg: number
          rating_count: number
          students_count: number
          subjects: string[]
          timezone: string | null
          total_earnings_cents: number
          updated_at: string
          user_id: string
          years_experience: number
        }
        Insert: {
          accepts_bookings?: boolean
          bio_long?: string | null
          created_at?: string
          currency?: string
          hourly_rate_cents?: number
          rating_avg?: number
          rating_count?: number
          students_count?: number
          subjects?: string[]
          timezone?: string | null
          total_earnings_cents?: number
          updated_at?: string
          user_id: string
          years_experience?: number
        }
        Update: {
          accepts_bookings?: boolean
          bio_long?: string | null
          created_at?: string
          currency?: string
          hourly_rate_cents?: number
          rating_avg?: number
          rating_count?: number
          students_count?: number
          subjects?: string[]
          timezone?: string | null
          total_earnings_cents?: number
          updated_at?: string
          user_id?: string
          years_experience?: number
        }
        Relationships: []
      }
      teacher_reviews: {
        Row: {
          appointment_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          student_id: string
          teacher_id: string
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          student_id: string
          teacher_id: string
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_schools: {
        Row: {
          created_at: string
          id: string
          school_id: string
          status: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          status?: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_verifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mod_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "moderator" | "admin" | "super_admin"
      arena_attempt_status: "in_progress" | "passed" | "failed" | "abandoned"
      arena_battle_mode:
        | "1v1"
        | "team"
        | "classroom"
        | "survival"
        | "speedrun"
        | "boss"
      arena_battle_state: "pending" | "live" | "finished" | "cancelled"
      arena_challenge_status: "draft" | "published" | "archived"
      arena_challenge_type:
        | "quiz"
        | "code"
        | "math"
        | "science"
        | "language"
        | "essay"
        | "logic"
        | "simulation"
      arena_difficulty: "easy" | "medium" | "hard" | "expert"
      arena_reward_rarity: "common" | "rare" | "epic" | "legendary" | "mythic"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
      report_target_type:
        | "lesson"
        | "comment"
        | "chat_message"
        | "user"
        | "direct_message"
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
      app_role: ["user", "moderator", "admin", "super_admin"],
      arena_attempt_status: ["in_progress", "passed", "failed", "abandoned"],
      arena_battle_mode: [
        "1v1",
        "team",
        "classroom",
        "survival",
        "speedrun",
        "boss",
      ],
      arena_battle_state: ["pending", "live", "finished", "cancelled"],
      arena_challenge_status: ["draft", "published", "archived"],
      arena_challenge_type: [
        "quiz",
        "code",
        "math",
        "science",
        "language",
        "essay",
        "logic",
        "simulation",
      ],
      arena_difficulty: ["easy", "medium", "hard", "expert"],
      arena_reward_rarity: ["common", "rare", "epic", "legendary", "mythic"],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
      report_target_type: [
        "lesson",
        "comment",
        "chat_message",
        "user",
        "direct_message",
      ],
    },
  },
} as const
