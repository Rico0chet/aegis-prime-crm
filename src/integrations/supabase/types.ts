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
      activities: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          occurred_at: string
          policy_id: string | null
          summary: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          occurred_at?: string
          policy_id?: string | null
          summary: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          occurred_at?: string
          policy_id?: string | null
          summary?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          calendar_event_id: string | null
          calendar_provider: string | null
          client_id: string | null
          created_at: string
          email: string
          ends_at: string
          first_name: string
          id: string
          last_name: string
          meeting_url: string | null
          phone: string | null
          reason: string | null
          starts_at: string
          status: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          calendar_provider?: string | null
          client_id?: string | null
          created_at?: string
          email: string
          ends_at: string
          first_name: string
          id?: string
          last_name: string
          meeting_url?: string | null
          phone?: string | null
          reason?: string | null
          starts_at: string
          status?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          calendar_provider?: string | null
          client_id?: string | null
          created_at?: string
          email?: string
          ends_at?: string
          first_name?: string
          id?: string
          last_name?: string
          meeting_url?: string | null
          phone?: string | null
          reason?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          access_mode: string
          created_at: string
          custom_price_cents: number | null
          discount_percent: number
          notes: string | null
          paddle_discount_env: string | null
          paddle_discount_id: string | null
          paddle_discount_key: string | null
          referral_code: string
          referred_by: string | null
          trial_ends_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_mode?: string
          created_at?: string
          custom_price_cents?: number | null
          discount_percent?: number
          notes?: string | null
          paddle_discount_env?: string | null
          paddle_discount_id?: string | null
          paddle_discount_key?: string | null
          referral_code: string
          referred_by?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_mode?: string
          created_at?: string
          custom_price_cents?: number | null
          discount_percent?: number
          notes?: string | null
          paddle_discount_env?: string | null
          paddle_discount_id?: string | null
          paddle_discount_key?: string | null
          referral_code?: string
          referred_by?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_settings: {
        Row: {
          base_price_cents: number
          created_at: string
          id: boolean
          referral_discount_percent: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          created_at?: string
          id?: boolean
          referral_discount_percent?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          created_at?: string
          id?: boolean
          referral_discount_percent?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_transactions: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency_code: string | null
          environment: string
          id: string
          occurred_at: string
          paddle_subscription_id: string | null
          paddle_transaction_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency_code?: string | null
          environment?: string
          id?: string
          occurred_at?: string
          paddle_subscription_id?: string | null
          paddle_transaction_id: string
          status: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency_code?: string | null
          environment?: string
          id?: string
          occurred_at?: string
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          buffer_minutes: number
          calendar_provider: string
          created_at: string
          end_time: string
          headline: string | null
          horizon_days: number
          intro: string | null
          is_enabled: boolean
          lead_hours: number
          slot_minutes: number
          slug: string
          start_time: string
          timezone: string
          updated_at: string
          user_id: string
          work_days: number[]
        }
        Insert: {
          buffer_minutes?: number
          calendar_provider?: string
          created_at?: string
          end_time?: string
          headline?: string | null
          horizon_days?: number
          intro?: string | null
          is_enabled?: boolean
          lead_hours?: number
          slot_minutes?: number
          slug: string
          start_time?: string
          timezone?: string
          updated_at?: string
          user_id: string
          work_days?: number[]
        }
        Update: {
          buffer_minutes?: number
          calendar_provider?: string
          created_at?: string
          end_time?: string
          headline?: string | null
          horizon_days?: number
          intro?: string | null
          is_enabled?: boolean
          lead_hours?: number
          slot_minutes?: number
          slug?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          work_days?: number[]
        }
        Relationships: []
      }
      client_needs_analyses: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_needs_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_needs_analyses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "needs_analysis_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          birthday_email_enabled: boolean
          birthday_email_last_sent_year: number | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          birthday_email_enabled?: boolean
          birthday_email_last_sent_year?: number | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          birthday_email_enabled?: boolean
          birthday_email_last_sent_year?: number | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intake_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          submission_count: number
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          submission_count?: number
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          submission_count?: number
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      needs_analysis_answers: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          question_id: string
          updated_at: string
          user_id: string
          value: string | null
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          question_id: string
          updated_at?: string
          user_id: string
          value?: string | null
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          question_id?: string
          updated_at?: string
          user_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "needs_analysis_answers_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "client_needs_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_analysis_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "needs_analysis_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      needs_analysis_invites: {
        Row: {
          analysis_id: string | null
          client_id: string
          created_at: string
          expires_at: string
          id: string
          opened_at: string | null
          revoked_at: string | null
          submitted_at: string | null
          template_id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          opened_at?: string | null
          revoked_at?: string | null
          submitted_at?: string | null
          template_id: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          opened_at?: string | null
          revoked_at?: string | null
          submitted_at?: string | null
          template_id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "needs_analysis_invites_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "client_needs_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_analysis_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_analysis_invites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "needs_analysis_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      needs_analysis_questions: {
        Row: {
          created_at: string
          help_text: string | null
          id: string
          input_type: Database["public"]["Enums"]["question_input_type"]
          is_required: boolean
          options: Json
          prompt: string
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          help_text?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["question_input_type"]
          is_required?: boolean
          options?: Json
          prompt: string
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          help_text?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["question_input_type"]
          is_required?: boolean
          options?: Json
          prompt?: string
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "needs_analysis_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "needs_analysis_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      needs_analysis_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_type: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_type?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_type?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          annual_premium: number | null
          application_date: string | null
          carrier: string
          client_id: string
          created_at: string
          face_amount: number | null
          id: string
          issue_date: string | null
          notes: string | null
          policy_number: string | null
          product_type: string
          renewal_date: string | null
          status: Database["public"]["Enums"]["policy_status"]
          target_commission: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_premium?: number | null
          application_date?: string | null
          carrier: string
          client_id: string
          created_at?: string
          face_amount?: number | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          policy_number?: string | null
          product_type: string
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          target_commission?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_premium?: number | null
          application_date?: string | null
          carrier?: string
          client_id?: string
          created_at?: string
          face_amount?: number | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          policy_number?: string | null
          product_type?: string
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          target_commission?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      producer_licenses: {
        Row: {
          created_at: string
          expires_on: string | null
          id: string
          is_active: boolean
          issued_on: string | null
          license_number: string
          lines_of_authority: string | null
          notes: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: string
          is_active?: boolean
          issued_on?: string | null
          license_number: string
          lines_of_authority?: string | null
          notes?: string | null
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: string
          is_active?: boolean
          issued_on?: string | null
          license_number?: string
          lines_of_authority?: string | null
          notes?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          license_number: string | null
          linkedin_url: string | null
          nipr_url: string | null
          npn: string | null
          phone: string | null
          surelc_url: string | null
          title: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          agency?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          license_number?: string | null
          linkedin_url?: string | null
          nipr_url?: string | null
          npn?: string | null
          phone?: string | null
          surelc_url?: string | null
          title?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          agency?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          license_number?: string | null
          linkedin_url?: string | null
          nipr_url?: string | null
          npn?: string | null
          phone?: string | null
          surelc_url?: string | null
          title?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          client_id: string | null
          completed: boolean
          created_at: string
          due_at: string | null
          id: string
          policy_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          completed?: boolean
          created_at?: string
          due_at?: string | null
          id?: string
          policy_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          completed?: boolean
          created_at?: string
          due_at?: string | null
          id?: string
          policy_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
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
      generate_referral_code: { Args: never; Returns: string }
      has_billing_access: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      producer_has_access: { Args: { user_uuid: string }; Returns: boolean }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note"
      app_role: "admin" | "producer"
      client_status: "prospect" | "active" | "inactive"
      policy_status:
        | "quoted"
        | "submitted"
        | "underwriting"
        | "medical_scheduled"
        | "approved"
        | "issued"
        | "declined"
      question_input_type:
        | "short_text"
        | "long_text"
        | "number"
        | "currency"
        | "date"
        | "yes_no"
        | "single_select"
        | "multi_select"
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
      activity_type: ["call", "email", "meeting", "note"],
      app_role: ["admin", "producer"],
      client_status: ["prospect", "active", "inactive"],
      policy_status: [
        "quoted",
        "submitted",
        "underwriting",
        "medical_scheduled",
        "approved",
        "issued",
        "declined",
      ],
      question_input_type: [
        "short_text",
        "long_text",
        "number",
        "currency",
        "date",
        "yes_no",
        "single_select",
        "multi_select",
      ],
    },
  },
} as const
