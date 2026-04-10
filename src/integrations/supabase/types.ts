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
      campanhas: {
        Row: {
          budget: number | null
          budget_type: string | null
          clicks: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          id: string
          impressions: number | null
          leads_api: number | null
          meta_campaign_id: string | null
          name: string
          objective: string | null
          reach: number | null
          roas: number | null
          spend: number | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          budget?: number | null
          budget_type?: string | null
          clicks?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          leads_api?: number | null
          meta_campaign_id?: string | null
          name: string
          objective?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          budget?: number | null
          budget_type?: string | null
          clicks?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          leads_api?: number | null
          meta_campaign_id?: string | null
          name?: string
          objective?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      configuracoes_whatsapp: {
        Row: {
          api_key: string | null
          auto_send: boolean | null
          created_at: string
          id: string
          instance_id: string | null
          message_template: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key?: string | null
          auto_send?: boolean | null
          created_at?: string
          id?: string
          instance_id?: string | null
          message_template?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key?: string | null
          auto_send?: boolean | null
          created_at?: string
          id?: string
          instance_id?: string | null
          message_template?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      criativos: {
        Row: {
          adset_name: string | null
          campaign_name: string | null
          clicks: number | null
          cpl: number | null
          created_at: string
          ctr: number | null
          effective_status: string | null
          id: string
          impressions: number | null
          leads: number | null
          meta_creative_id: string | null
          name: string
          spend: number | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adset_name?: string | null
          campaign_name?: string | null
          clicks?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          effective_status?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_creative_id?: string | null
          name: string
          spend?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adset_name?: string | null
          campaign_name?: string | null
          clicks?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          effective_status?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_creative_id?: string | null
          name?: string
          spend?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          cidade: string | null
          created_at: string
          entrada: string | null
          id: string
          nome: string
          observacoes: string | null
          quiz_data: Json | null
          status: number
          updated_at: string
          user_id: string | null
          wa_sent: boolean | null
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          entrada?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          quiz_data?: Json | null
          status?: number
          updated_at?: string
          user_id?: string | null
          wa_sent?: boolean | null
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          entrada?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          quiz_data?: Json | null
          status?: number
          updated_at?: string
          user_id?: string | null
          wa_sent?: boolean | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          status?: string | null
          user_id?: string | null
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
