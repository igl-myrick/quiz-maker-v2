
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "option_keys": {
                  Row: {
                    "is_correct": boolean | null,"option_id": string,"outcome_id": string | null,"points": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "is_correct"?: boolean | null,"option_id": string,"outcome_id"?: string | null,"points"?: number | null
                  }
                  Update: {
                    "is_correct"?: boolean | null,"option_id"?: string,"outcome_id"?: string | null,"points"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "option_keys_option_id_fkey"
      columns: ["option_id"]
isOneToOne: true
      referencedRelation: "options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "option_keys_outcome_id_fkey"
      columns: ["outcome_id"]
isOneToOne: false
      referencedRelation: "outcomes"
      referencedColumns: ["id"]
    }
                  ]
                },"options": {
                  Row: {
                    "id": string,"label": string,"position": number,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"label": string,"position": number,"question_id": string
                  }
                  Update: {
                    "id"?: string,"label"?: string,"position"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "options_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"outcomes": {
                  Row: {
                    "description": string,"id": string,"position": number,"quiz_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"id"?: string,"position": number,"quiz_id": string,"title": string
                  }
                  Update: {
                    "description"?: string,"id"?: string,"position"?: number,"quiz_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outcomes_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outcomes_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes_public"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "id": string,"position": number,"prompt": string,"quiz_id": string,"type": Database["public"]['Enums']["question_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"position": number,"prompt": string,"quiz_id": string,"type": Database["public"]['Enums']["question_type"]
                  }
                  Update: {
                    "id"?: string,"position"?: number,"prompt"?: string,"quiz_id"?: string,"type"?: Database["public"]['Enums']["question_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes_public"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_versions": {
                  Row: {
                    "quiz_id": string,"retired_at": string,"snapshot": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "quiz_id": string,"retired_at"?: string,"snapshot": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "quiz_id"?: string,"retired_at"?: string,"snapshot"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"quizzes": {
                  Row: {
                    "created_at": string,"creator_id": string,"description": string,"id": string,"kind": Database["public"]['Enums']["quiz_kind"],"normalized_title": string | null,"search": unknown,"suggested_time_seconds": number | null,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"creator_id": string,"description"?: string,"id"?: string,"kind": Database["public"]['Enums']["quiz_kind"],"normalized_title"?: never,"search"?: never,"suggested_time_seconds"?: number | null,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"description"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["quiz_kind"],"normalized_title"?: never,"search"?: never,"suggested_time_seconds"?: number | null,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"scope": Database["public"]['Enums']["rate_limit_scope"],"subject": string,"window_ends_at": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count": number,"scope": Database["public"]['Enums']["rate_limit_scope"],"subject": string,"window_ends_at": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"scope"?: Database["public"]['Enums']["rate_limit_scope"],"subject"?: string,"window_ends_at"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"results": {
                  Row: {
                    "claim_token_hash": string | null,"created_at": string,"duration_seconds": number | null,"expires_at": string | null,"id": string,"outcome_ranking": Json | null,"owner_id": string | null,"quiz_id": string | null,"quiz_kind": Database["public"]['Enums']["quiz_kind"],"quiz_title": string,"quiz_version": number,"score": number | null,"snapshot": NonNullable<Json>,"timed": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_token_hash"?: string | null,"created_at"?: string,"duration_seconds"?: number | null,"expires_at"?: string | null,"id"?: string,"outcome_ranking"?: Json | null,"owner_id"?: string | null,"quiz_id"?: string | null,"quiz_kind": Database["public"]['Enums']["quiz_kind"],"quiz_title": string,"quiz_version": number,"score"?: number | null,"snapshot": NonNullable<Json>,"timed"?: boolean
                  }
                  Update: {
                    "claim_token_hash"?: string | null,"created_at"?: string,"duration_seconds"?: number | null,"expires_at"?: string | null,"id"?: string,"outcome_ranking"?: Json | null,"owner_id"?: string | null,"quiz_id"?: string | null,"quiz_kind"?: Database["public"]['Enums']["quiz_kind"],"quiz_title"?: string,"quiz_version"?: number,"score"?: number | null,"snapshot"?: NonNullable<Json>,"timed"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "results_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes_public"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "quizzes_public": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"kind": Database["public"]['Enums']["quiz_kind"],"question_count": number | null,"search": unknown,"suggested_time_seconds": number | null,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"description"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["quiz_kind"] | null,"question_count"?: never,"search"?: unknown,"suggested_time_seconds"?: number | null,"title"?: string | null,"updated_at"?: string | null,"version"?: number | null
                         }
                        Update: {
                           "created_at"?: string | null,"description"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["quiz_kind"] | null,"question_count"?: never,"search"?: unknown,"suggested_time_seconds"?: number | null,"title"?: string | null,"updated_at"?: string | null,"version"?: number | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "claim_result":
{ Args: { "p_id": string,"p_token": string }; Returns: boolean
                           },
"cleanup_expired":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"get_quiz_for_edit":
{ Args: { "p_id": string }; Returns: Json
                           },
"get_result":
{ Args: { "p_id": string }; Returns: Json
                           },
"hit_rate_limit":
{ Args: { "p_max": number,"p_scope": Database["public"]['Enums']["rate_limit_scope"],"p_subject": string,"p_window": string }; Returns: boolean
                           },
"list_my_quizzes":
{ Args: { "p_cursor"?: Json,"p_limit"?: number }; Returns: Json
                           },
"list_my_results":
{ Args: { "p_cursor"?: Json,"p_limit"?: number }; Returns: Json
                           },
"quiz_snapshot":
{ Args: { "p_quiz_id": string }; Returns: Json
                           },
"retire_quiz_version":
{ Args: { "p_quiz_id": string }; Returns: undefined
                           },
"save_quiz":
{ Args: { "p_quiz": Json }; Returns: Json
                           },
"search_quizzes":
{ Args: { "p_cursor"?: Json,"p_limit"?: number,"p_query": string }; Returns: Json
                           },
"trim_text":
{ Args: { "p_text": string }; Returns: string
                           }
          }
          Enums: {
            "question_type": "single_choice"|"true_false"|"multi_select","quiz_kind": "trivia"|"personality","rate_limit_scope": "anon_submit"|"member_submit"|"quiz_create"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "question_type": ["single_choice", "true_false", "multi_select"],"quiz_kind": ["trivia", "personality"],"rate_limit_scope": ["anon_submit", "member_submit", "quiz_create"]
          }
        }
} as const
