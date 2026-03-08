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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academic_events: {
        Row: {
          content_topics: string | null
          created_at: string
          description: string | null
          due_date: string | null
          event_date: string
          id: string
          is_group: boolean | null
          reminder_config: Json | null
          status: string
          subject_id: string
          title: string
          type: string
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          content_topics?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          event_date: string
          id?: string
          is_group?: boolean | null
          reminder_config?: Json | null
          status?: string
          subject_id: string
          title: string
          type: string
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          content_topics?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          event_date?: string
          id?: string
          is_group?: boolean | null
          reminder_config?: Json | null
          status?: string
          subject_id?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          due_date: string
          id: string
          month: number
          name: string
          paid: boolean
          type: string
          updated_at: string
          user_id: string
          wallet_id: string | null
          year: number
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          month: number
          name: string
          paid?: boolean
          type: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
          year: number
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          month?: number
          name?: string
          paid?: boolean
          type?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      fit_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      fit_meal_plans: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          pdf_url: string | null
          plan_data: Json
          shopping_list: Json | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          plan_data?: Json
          shopping_list?: Json | null
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          plan_data?: Json
          shopping_list?: Json | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fit_profiles: {
        Row: {
          age: number | null
          available_equipment: Json | null
          bmi: number | null
          created_at: string
          diet_type: string | null
          experience_level: string | null
          food_allergies: Json | null
          food_intolerances: Json | null
          goal: string | null
          has_nutritionist: boolean | null
          height: number | null
          id: string
          medical_conditions: Json | null
          monthly_food_budget: number | null
          nutritional_program: string | null
          onboarding_completed: boolean | null
          sex: string | null
          supplements: Json | null
          training_location: string | null
          updated_at: string
          user_id: string
          weekly_availability: Json | null
          weight: number | null
        }
        Insert: {
          age?: number | null
          available_equipment?: Json | null
          bmi?: number | null
          created_at?: string
          diet_type?: string | null
          experience_level?: string | null
          food_allergies?: Json | null
          food_intolerances?: Json | null
          goal?: string | null
          has_nutritionist?: boolean | null
          height?: number | null
          id?: string
          medical_conditions?: Json | null
          monthly_food_budget?: number | null
          nutritional_program?: string | null
          onboarding_completed?: boolean | null
          sex?: string | null
          supplements?: Json | null
          training_location?: string | null
          updated_at?: string
          user_id: string
          weekly_availability?: Json | null
          weight?: number | null
        }
        Update: {
          age?: number | null
          available_equipment?: Json | null
          bmi?: number | null
          created_at?: string
          diet_type?: string | null
          experience_level?: string | null
          food_allergies?: Json | null
          food_intolerances?: Json | null
          goal?: string | null
          has_nutritionist?: boolean | null
          height?: number | null
          id?: string
          medical_conditions?: Json | null
          monthly_food_budget?: number | null
          nutritional_program?: string | null
          onboarding_completed?: boolean | null
          sex?: string | null
          supplements?: Json | null
          training_location?: string | null
          updated_at?: string
          user_id?: string
          weekly_availability?: Json | null
          weight?: number | null
        }
        Relationships: []
      }
      fit_progress: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          measurements: Json | null
          notes: string | null
          photos: Json | null
          record_date: string
          user_id: string
          weight: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measurements?: Json | null
          notes?: string | null
          photos?: Json | null
          record_date?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measurements?: Json | null
          notes?: string | null
          photos?: Json | null
          record_date?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      fit_reminders: {
        Row: {
          created_at: string
          days: Json | null
          enabled: boolean | null
          id: string
          time: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: Json | null
          enabled?: boolean | null
          id?: string
          time: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: Json | null
          enabled?: boolean | null
          id?: string
          time?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fit_workout_logs: {
        Row: {
          created_at: string
          duration_minutes: number | null
          exercises: Json
          id: string
          mood: string | null
          notes: string | null
          plan_id: string | null
          user_id: string
          workout_date: string
          workout_name: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          exercises?: Json
          id?: string
          mood?: string | null
          notes?: string | null
          plan_id?: string | null
          user_id: string
          workout_date?: string
          workout_name: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          exercises?: Json
          id?: string
          mood?: string | null
          notes?: string | null
          plan_id?: string | null
          user_id?: string
          workout_date?: string
          workout_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fit_workout_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "fit_workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      fit_workout_plans: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          pdf_url: string | null
          plan_data: Json
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          plan_data?: Json
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          plan_data?: Json
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          month: number
          recurring: boolean
          updated_at: string
          user_id: string
          wallet_id: string | null
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          month: number
          recurring?: boolean
          updated_at?: string
          user_id: string
          wallet_id?: string | null
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          month?: number
          recurring?: boolean
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "incomes_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      pomodoro_sessions: {
        Row: {
          completed_pomodoros: number
          created_at: string
          id: string
          session_date: string
          subject_id: string
          total_focus_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_pomodoros?: number
          created_at?: string
          id?: string
          session_date?: string
          subject_id: string
          total_focus_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_pomodoros?: number
          created_at?: string
          id?: string
          session_date?: string
          subject_id?: string
          total_focus_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pomodoro_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_notifications: boolean
          id: string
          notifications_enabled: boolean
          phone: string | null
          phone_verified: boolean
          updated_at: string
          user_id: string
          whatsapp_notifications: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          id?: string
          notifications_enabled?: boolean
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
          user_id: string
          whatsapp_notifications?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          id?: string
          notifications_enabled?: boolean
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_notifications?: boolean
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string
          current_amount: number
          deadline: string | null
          id: string
          name: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          name: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          name?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          subject_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          subject_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_chat_messages_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string | null
          course: string | null
          created_at: string
          ementa_text: string | null
          ementa_url: string | null
          id: string
          name: string
          schedule: Json | null
          semester: string | null
          teacher: string | null
          type: string
          updated_at: string
          user_id: string
          weekly_hours: number | null
        }
        Insert: {
          color?: string | null
          course?: string | null
          created_at?: string
          ementa_text?: string | null
          ementa_url?: string | null
          id?: string
          name: string
          schedule?: Json | null
          semester?: string | null
          teacher?: string | null
          type?: string
          updated_at?: string
          user_id: string
          weekly_hours?: number | null
        }
        Update: {
          color?: string | null
          course?: string | null
          created_at?: string
          ementa_text?: string | null
          ementa_url?: string | null
          id?: string
          name?: string
          schedule?: Json | null
          semester?: string | null
          teacher?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          weekly_hours?: number | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
