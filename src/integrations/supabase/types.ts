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
      campaign_events: {
        Row: {
          beat_id: string | null
          campaign_id: string
          created_at: string
          data: Json
          id: string
          roll: Json | null
          seq: number
          summary: string | null
          type: string
        }
        Insert: {
          beat_id?: string | null
          campaign_id: string
          created_at?: string
          data?: Json
          id?: string
          roll?: Json | null
          seq?: number
          summary?: string | null
          type: string
        }
        Update: {
          beat_id?: string | null
          campaign_id?: string
          created_at?: string
          data?: Json
          id?: string
          roll?: Json | null
          seq?: number
          summary?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_factions: {
        Row: {
          campaign_id: string
          faction_id: string
          id: string
          name: string
          notes: string | null
          standing: number
        }
        Insert: {
          campaign_id: string
          faction_id: string
          id?: string
          name: string
          notes?: string | null
          standing?: number
        }
        Update: {
          campaign_id?: string
          faction_id?: string
          id?: string
          name?: string
          notes?: string | null
          standing?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_factions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_flags: {
        Row: {
          campaign_id: string
          flag: string
          id: string
          value: Json
        }
        Insert: {
          campaign_id: string
          flag: string
          id?: string
          value?: Json
        }
        Update: {
          campaign_id?: string
          flag?: string
          id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_flags_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_inventory: {
        Row: {
          campaign_id: string
          current_sp: number | null
          equipped: boolean
          id: string
          item_id: string
          kind: string
          notes: string | null
          quantity: number
          slot: string | null
        }
        Insert: {
          campaign_id: string
          current_sp?: number | null
          equipped?: boolean
          id?: string
          item_id: string
          kind?: string
          notes?: string | null
          quantity?: number
          slot?: string | null
        }
        Update: {
          campaign_id?: string
          current_sp?: number | null
          equipped?: boolean
          id?: string
          item_id?: string
          kind?: string
          notes?: string | null
          quantity?: number
          slot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_inventory_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_npcs: {
        Row: {
          campaign_id: string
          data: Json
          disposition: number
          id: string
          location: string | null
          name: string
          notes: string | null
          npc_id: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          data?: Json
          disposition?: number
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          npc_id?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          data?: Json
          disposition?: number
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          npc_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_vitals: {
        Row: {
          campaign_id: string
          eurobucks: number
          hp_current: number
          hp_max: number
          humanity_current: number
          humanity_max: number
          mortal_save_failures: number
          seriously_wounded_threshold: number
          updated_at: string
          wound_state: string
        }
        Insert: {
          campaign_id: string
          eurobucks?: number
          hp_current: number
          hp_max: number
          humanity_current: number
          humanity_max: number
          mortal_save_failures?: number
          seriously_wounded_threshold: number
          updated_at?: string
          wound_state?: string
        }
        Update: {
          campaign_id?: string
          eurobucks?: number
          hp_current?: number
          hp_max?: number
          humanity_current?: number
          humanity_max?: number
          mortal_save_failures?: number
          seriously_wounded_threshold?: number
          updated_at?: string
          wound_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_vitals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          character_id: string
          created_at: string
          current_mission_id: string | null
          day: number
          id: string
          ip_awarded: number | null
          minute: number
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          current_mission_id?: string | null
          day?: number
          id?: string
          ip_awarded?: number | null
          minute?: number
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          current_mission_id?: string | null
          day?: number
          id?: string
          ip_awarded?: number | null
          minute?: number
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
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
          improvement_points: number
          lifestyle: string | null
          rent: number | null
        }
        Insert: {
          character_id: string
          eurobucks?: number
          housing?: string | null
          improvement_points?: number
          lifestyle?: string | null
          rent?: number | null
        }
        Update: {
          character_id?: string
          eurobucks?: number
          housing?: string | null
          improvement_points?: number
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
          portrait_path: string | null
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
          portrait_path?: string | null
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
          portrait_path?: string | null
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
      encounter_combatants: {
        Row: {
          body: number
          character_id: string | null
          data: Json
          death_save_penalty: number
          defeated: boolean
          encounter_id: string
          hp_current: number
          hp_max: number
          id: string
          initiative: number | null
          is_player: boolean
          name: string
          ref: number
          seriously_wounded_threshold: number
          side: string
          sp_body: number
          sp_head: number
          wound_state: string
        }
        Insert: {
          body: number
          character_id?: string | null
          data?: Json
          death_save_penalty?: number
          defeated?: boolean
          encounter_id: string
          hp_current: number
          hp_max: number
          id?: string
          initiative?: number | null
          is_player?: boolean
          name: string
          ref: number
          seriously_wounded_threshold: number
          side?: string
          sp_body?: number
          sp_head?: number
          wound_state?: string
        }
        Update: {
          body?: number
          character_id?: string | null
          data?: Json
          death_save_penalty?: number
          defeated?: boolean
          encounter_id?: string
          hp_current?: number
          hp_max?: number
          id?: string
          initiative?: number | null
          is_player?: boolean
          name?: string
          ref?: number
          seriously_wounded_threshold?: number
          side?: string
          sp_body?: number
          sp_head?: number
          wound_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_combatants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_combatants_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          active_index: number
          beat_id: string | null
          campaign_id: string
          created_at: string
          id: string
          name: string | null
          order_ids: Json
          round: number
          status: string
          updated_at: string
        }
        Insert: {
          active_index?: number
          beat_id?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          name?: string | null
          order_ids?: Json
          round?: number
          status?: string
          updated_at?: string
        }
        Update: {
          active_index?: number
          beat_id?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string | null
          order_ids?: Json
          round?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_progress: {
        Row: {
          branch_choices: Json
          campaign_id: string
          completed_beats: Json
          created_at: string
          current_beat_id: string | null
          id: string
          mission_id: string
          objectives: Json
          status: string
          updated_at: string
        }
        Insert: {
          branch_choices?: Json
          campaign_id: string
          completed_beats?: Json
          created_at?: string
          current_beat_id?: string | null
          id?: string
          mission_id: string
          objectives?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          branch_choices?: Json
          campaign_id?: string
          completed_beats?: Json
          created_at?: string
          current_beat_id?: string | null
          id?: string
          mission_id?: string
          objectives?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_progress_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_campaign: { Args: { _campaign_id: string }; Returns: boolean }
      owns_character: { Args: { _character_id: string }; Returns: boolean }
      owns_encounter: { Args: { _encounter_id: string }; Returns: boolean }
      save_character: { Args: { payload: Json }; Returns: string }
      spend_ip_on_skill: {
        Args: {
          p_character_id: string
          p_cost: number
          p_new_level: number
          p_skill_id: string
          p_specialization?: string | null
        }
        Returns: number
      }
      start_campaign: { Args: { payload: Json }; Returns: string }
      start_encounter: { Args: { payload: Json }; Returns: string }
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
