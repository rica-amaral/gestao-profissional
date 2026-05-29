export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          owner_id: string
          name: string
          phone: string
          birth_date: string | null
          notes: string | null
          payment_pending: boolean
          blocked: boolean
          last_visit_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          phone: string
          birth_date?: string | null
          notes?: string | null
          payment_pending?: boolean
          blocked?: boolean
          last_visit_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          id: string
          owner_id: string
          name: string
          phone: string
          birth_date: string | null
          notes: string | null
          payment_pending: boolean
          blocked: boolean
          last_visit_date: string | null
          created_at: string
          updated_at: string
        }>
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          owner_id: string
          client_id: string
          date: string
          time: string
          confirmed: boolean
          paid: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          client_id: string
          date: string
          time: string
          confirmed?: boolean
          paid?: boolean
          notes?: string | null
        }
        Update: Partial<{
          id: string
          client_id: string
          date: string
          time: string
          confirmed: boolean
          paid: boolean
          notes: string | null
        }>
        Relationships: []
      }
      evaluations: {
        Row: {
          id: string
          owner_id: string
          client_id: string
          seq: number
          date: string
          notes: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          client_id: string
          seq: number
          date: string
          notes?: string | null
          details?: Json | null
        }
        Update: Partial<{
          id: string
          client_id: string
          seq: number
          date: string
          notes: string | null
          details: Json | null
        }>
        Relationships: []
      }
      adherence_events: {
        Row: {
          id: string
          owner_id: string
          client_id: string
          type: "falta" | "cancelamento" | "reagendamento"
          at: string
          note: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          client_id: string
          type: "falta" | "cancelamento" | "reagendamento"
          at?: string
          note?: string | null
        }
        Update: Partial<{
          id: string
          client_id: string
          type: "falta" | "cancelamento" | "reagendamento"
          at: string
          note: string | null
        }>
        Relationships: []
      }
      clinic_settings: {
        Row: {
          owner_id: string
          schedule_start: string
          schedule_end: string
          early_block_until_hour: number
          lunch_start: string
          lunch_end: string
          day_early_unlocked: Json
          location_address: string
          services: Json
          message_confirmation: string
          message_reminder: string
          message_birthday: string
          next_eval_seq: number
          updated_at: string
        }
        Insert: {
          owner_id: string
          schedule_start?: string
          schedule_end?: string
          early_block_until_hour?: number
          lunch_start?: string
          lunch_end?: string
          day_early_unlocked?: Json
          location_address?: string
          services?: Json
          message_confirmation?: string
          message_reminder?: string
          message_birthday?: string
          next_eval_seq?: number
        }
        Update: Partial<{
          schedule_start: string
          schedule_end: string
          early_block_until_hour: number
          lunch_start: string
          lunch_end: string
          day_early_unlocked: Json
          location_address: string
          services: Json
          message_confirmation: string
          message_reminder: string
          message_birthday: string
          next_eval_seq: number
        }>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
