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
      bookings: {
        Row: {
          booking_date: string
          booking_time: string
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          provider_id: string
          quoted_price: number
          service_address: string
          service_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          provider_id: string
          quoted_price: number
          service_address: string
          service_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          provider_id?: string
          quoted_price?: number
          service_address?: string
          service_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          commission_percent: number
          created_at: string
          id: string
          is_active: boolean
          minimum_withdrawal: number
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_withdrawal?: number
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_withdrawal?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          customer_id: string
          id: string
          method: string
          receipt_number: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          customer_id: string
          id?: string
          method: string
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          method?: string
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["app_role"]
          address: string | null
          avatar_url: string | null
          block_name: string | null
          created_at: string
          district: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          village: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["app_role"]
          address?: string | null
          avatar_url?: string | null
          block_name?: string | null
          created_at?: string
          district?: string | null
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
          village?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["app_role"]
          address?: string | null
          avatar_url?: string | null
          block_name?: string | null
          created_at?: string
          district?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      provider_kyc: {
        Row: {
          aadhaar_document_path: string | null
          certificate_path: string | null
          created_at: string
          id: string
          pan_document_path: string | null
          provider_user_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
        }
        Insert: {
          aadhaar_document_path?: string | null
          certificate_path?: string | null
          created_at?: string
          id?: string
          pan_document_path?: string | null
          provider_user_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
        }
        Update: {
          aadhaar_document_path?: string | null
          certificate_path?: string | null
          created_at?: string
          id?: string
          pan_document_path?: string | null
          provider_user_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
        }
        Relationships: []
      }
      provider_profiles: {
        Row: {
          bio: string | null
          block_name: string | null
          completed_jobs: number
          created_at: string
          display_name: string
          district: string
          experience_years: number
          id: string
          is_available: boolean
          is_featured: boolean
          is_verified: boolean
          photo_url: string | null
          price_unit: string
          rating: number
          review_count: number
          service_id: string | null
          skill: string
          starting_price: number
          updated_at: string
          user_id: string | null
          village: string | null
        }
        Insert: {
          bio?: string | null
          block_name?: string | null
          completed_jobs?: number
          created_at?: string
          display_name: string
          district: string
          experience_years?: number
          id?: string
          is_available?: boolean
          is_featured?: boolean
          is_verified?: boolean
          photo_url?: string | null
          price_unit?: string
          rating?: number
          review_count?: number
          service_id?: string | null
          skill: string
          starting_price: number
          updated_at?: string
          user_id?: string | null
          village?: string | null
        }
        Update: {
          bio?: string | null
          block_name?: string | null
          completed_jobs?: number
          created_at?: string
          display_name?: string
          district?: string
          experience_years?: number
          id?: string
          is_available?: boolean
          is_featured?: boolean
          is_verified?: boolean
          photo_url?: string | null
          price_unit?: string
          rating?: number
          review_count?: number
          service_id?: string | null
          skill?: string
          starting_price?: number
          updated_at?: string
          user_id?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_profiles_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
    }
    Enums: {
      app_role: "admin" | "provider" | "customer"
      booking_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "rejected"
      kyc_status: "draft" | "pending" | "approved" | "rejected"
      payment_status: "pending" | "paid" | "failed" | "refunded"
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
      app_role: ["admin", "provider", "customer"],
      booking_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
        "rejected",
      ],
      kyc_status: ["draft", "pending", "approved", "rejected"],
      payment_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
