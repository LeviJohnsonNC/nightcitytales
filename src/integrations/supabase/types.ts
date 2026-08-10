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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      character_cyberware: {
        Row: {
          character_id: string
          foundational_for: string | null
          humanity_loss_rolled: number | null
          id: string
          install_location: string | null
          item_id: string
        }
        Insert: {
          character_id: string
          foundational_for?: string | null
          humanity_loss_rolled?: number | null
          id?: string
          install_location?: string | null
          item_id: string
        }
        Update: {
          character_id?: string
          foundational_for?: string | null
          humanity_loss_rolled?: number | null
          id?: string
          install_location?: string | null
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_cyberware_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_cyberware_foundational_for_fkey"
            columns: ["foundational_for"]
            isOneToOne: false
            referencedRelation: "character_cyberware"
            referencedColumns: ["id"]
          },
        ]
      }
      character_finance: {
        Row: {
          character_id: string
          eurobucks: number
          housing: string | null
          lifestyle: string | null
          rent: number | null
        }
        Insert: {
          character_id: string
          eurobucks?: number
          housing?: string | null
          lifestyle?: string | null
          rent?: number | null
        }
        Update: {
          character_id?: string
          eurobucks?: number
          housing?: string | null
          lifestyle?: string | null
          rent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_finance_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_gear: {
        Row: {
          character_id: string
          current_sp: number | null
          equipped: boolean
          id: string
          item_id: string
          notes: string | null
          quantity: number
          slot: string | null
        }
        Insert: {
          character_id: string
          current_sp?: number | null
          equipped?: boolean
          id?: string
          item_id: string
          notes?: string | null
          quantity?: number
          slot?: string | null
        }
        Update: {
          character_id?: string
          current_sp?: number | null
          equipped?: boolean
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          slot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_gear_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_lifepath: {
        Row: {
          character_id: string
          general: Json
          role_specific: Json
        }
        Insert: {
          character_id: string
          general?: Json
          role_specific?: Json
        }
        Update: {
          character_id?: string
          general?: Json
          role_specific?: Json
        }
        Relationships: [
          {
            foreignKeyName: "character_lifepath_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_role_ability: {
        Row: {
          ability_id: string
          character_id: string
          metadata: Json
          rank: number
        }
        Insert: {
          ability_id: string
          character_id: string
          metadata?: Json
          rank?: number
        }
        Update: {
          ability_id?: string
          character_id?: string
          metadata?: Json
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_role_ability_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_skills: {
        Row: {
          character_id: string
          id: string
          level: number
          skill_id: string
          specialization: string | null
        }
        Insert: {
          character_id: string
          id?: string
          level: number
          skill_id: string
          specialization?: string | null
        }
        Update: {
          character_id?: string
          id?: string
          level?: number
          skill_id?: string
          specialization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_skills_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_stats: {
        Row: {
          body: number | null
          character_id: string
          cool: number | null
          death_save: number | null
          dex: number | null
          emp: number | null
          emp_max: number | null
          hp_current: number | null
          hp_max: number | null
          humanity_current: number | null
          humanity_max: number | null
          int: number | null
          luck: number | null
          move: number | null
          ref: number | null
          seriously_wounded_threshold: number | null
          tech: number | null
          will: number | null
        }
        Insert: {
          body?: number | null
          character_id: string
          cool?: number | null
          death_save?: number | null
          dex?: number | null
          emp?: number | null
          emp_max?: number | null
          hp_current?: number | null
          hp_max?: number | null
          humanity_current?: number | null
          humanity_max?: number | null
          int?: number | null
          luck?: number | null
          move?: number | null
          ref?: number | null
          seriously_wounded_threshold?: number | null
          tech?: number | null
          will?: number | null
        }
        Update: {
          body?: number | null
          character_id?: string
          cool?: number | null
          death_save?: number | null
          dex?: number | null
          emp?: number | null
          emp_max?: number | null
          hp_current?: number | null
          hp_max?: number | null
          humanity_current?: number | null
          humanity_max?: number | null
          int?: number | null
          luck?: number | null
          move?: number | null
          ref?: number | null
          seriously_wounded_threshold?: number | null
          tech?: number | null
          will?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_stats_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          created_at: string
          creation_method: string
          handle: string | null
          id: string
          is_complete: boolean
          name: string
          portrait_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creation_method: string
          handle?: string | null
          id?: string
          is_complete?: boolean
          name: string
          portrait_id?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creation_method?: string
          handle?: string | null
          id?: string
          is_complete?: boolean
          name?: string
          portrait_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chargen_drafts: {
        Row: {
          id: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          state: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          state?: Json
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
      owns_character: { Args: { _character_id: string }; Returns: boolean }
      save_character: { Args: { payload: Json }; Returns: string }
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
