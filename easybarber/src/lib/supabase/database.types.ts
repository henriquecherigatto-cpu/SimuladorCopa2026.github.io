// GENERATED FILE — do not hand-edit.
// Regenerate after changing supabase/migrations/*.sql:
//   npx supabase gen types typescript --db-url "<your-db-url>" --schema public > src/lib/supabase/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          ends_at: string;
          id: string;
          notes: string | null;
          professional_id: string;
          service_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          ends_at: string;
          id?: string;
          notes?: string | null;
          professional_id: string;
          service_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          ends_at?: string;
          id?: string;
          notes?: string | null;
          professional_id?: string;
          service_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_same_company_customer";
            columns: ["company_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "appointments_same_company_professional";
            columns: ["company_id", "professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "appointments_same_company_service";
            columns: ["company_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_profile_id: string | null;
          company_id: string | null;
          created_at: string;
          id: string;
          metadata: NonNullable<Json>;
          target_id: string | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_profile_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_profile_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey";
            columns: ["actor_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_events: {
        Row: {
          amount_cents: number | null;
          company_id: string;
          created_at: string;
          event_type: string;
          id: string;
          processed_at: string | null;
          provider: string;
          provider_event_id: string;
          raw_payload: Json | null;
          status: string;
          subscription_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents?: number | null;
          company_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          processed_at?: string | null;
          provider?: string;
          provider_event_id: string;
          raw_payload?: Json | null;
          status: string;
          subscription_id?: string | null;
        };
        Update: {
          amount_cents?: number | null;
          company_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          processed_at?: string | null;
          provider?: string;
          provider_event_id?: string;
          raw_payload?: Json | null;
          status?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_events_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      business_hours: {
        Row: {
          company_id: string;
          day_of_week: number;
          end_time: string;
          id: string;
          is_open: boolean;
          start_time: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          day_of_week: number;
          end_time?: string;
          id?: string;
          is_open?: boolean;
          start_time?: string;
        };
        Update: {
          company_id?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          is_open?: boolean;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_hours_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          address: string | null;
          cnpj: string | null;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          phone: string;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          phone: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          phone?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["company_member_role"];
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          profile_id: string;
          role: Database["public"]["Enums"]["company_member_role"];
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["company_member_role"];
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          company_id: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          created_at: string;
          features: NonNullable<Json>;
          id: string;
          max_customers: number | null;
          max_professionals: number | null;
          name: string;
          period: string;
          price_cents: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          features?: NonNullable<Json>;
          id?: string;
          max_customers?: number | null;
          max_professionals?: number | null;
          name: string;
          period?: string;
          price_cents: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          features?: NonNullable<Json>;
          id?: string;
          max_customers?: number | null;
          max_professionals?: number | null;
          name?: string;
          period?: string;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      professional_services: {
        Row: {
          professional_id: string;
          service_id: string;
        };
        ComputedFields: never;
        Insert: {
          professional_id: string;
          service_id: string;
        };
        Update: {
          professional_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      professionals: {
        Row: {
          active: boolean;
          color: string;
          company_id: string;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          profile_id: string | null;
          role_title: string;
          updated_at: string;
          weekly_days_off: number[];
          work_end: string;
          work_start: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          color?: string;
          company_id: string;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          profile_id?: string | null;
          role_title?: string;
          updated_at?: string;
          weekly_days_off?: number[];
          work_end?: string;
          work_start?: string;
        };
        Update: {
          active?: boolean;
          color?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          profile_id?: string | null;
          role_title?: string;
          updated_at?: string;
          weekly_days_off?: number[];
          work_end?: string;
          work_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professionals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professionals_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_platform_admin: boolean;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          is_platform_admin?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_platform_admin?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          company_id: string;
          created_at: string;
          description: string | null;
          duration_min: number;
          id: string;
          name: string;
          price_cents: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          company_id: string;
          created_at?: string;
          description?: string | null;
          duration_min: number;
          id?: string;
          name: string;
          price_cents: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          created_at?: string;
          description?: string | null;
          duration_min?: number;
          id?: string;
          name?: string;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          canceled_at: string | null;
          company_id: string;
          created_at: string;
          current_period_end: string | null;
          external_customer_id: string | null;
          grace_period_days: number;
          grace_period_ends_at: string | null;
          id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          canceled_at?: string | null;
          company_id: string;
          created_at?: string;
          current_period_end?: string | null;
          external_customer_id?: string | null;
          grace_period_days?: number;
          grace_period_ends_at?: string | null;
          id?: string;
          plan_id: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Update: {
          canceled_at?: string | null;
          company_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          external_customer_id?: string | null;
          grace_period_days?: number;
          grace_period_ends_at?: string | null;
          id?: string;
          plan_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      time_blocks: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string;
          ends_at: string;
          id: string;
          professional_id: string | null;
          reason: string | null;
          starts_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          created_by: string;
          ends_at: string;
          id?: string;
          professional_id?: string | null;
          reason?: string | null;
          starts_at: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string;
          ends_at?: string;
          id?: string;
          professional_id?: string | null;
          reason?: string | null;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_blocks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_blocks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_blocks_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_company_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          company_id: string;
          company_name: string;
          customer_count: number;
          next_payment_date: string;
          plan_name: string;
          professional_count: number;
          subscription_status: Database["public"]["Enums"]["subscription_status"];
        }[];
      };
      admin_platform_metrics: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active_companies: number;
          mrr_cents: number;
          new_companies_this_month: number;
          total_companies: number;
        }[];
      };
      apply_billing_event: {
        Args: {
          p_amount_cents: number;
          p_company_id: string;
          p_event_type: string;
          p_new_period_end?: string;
          p_provider: string;
          p_provider_event_id: string;
          p_raw_payload?: Json;
          p_status: string;
        };
        Returns: Json;
      };
      create_company_with_owner: {
        Args: { p_address?: string; p_cnpj?: string; p_name: string; p_phone: string };
        Returns: string;
      };
      create_public_appointment: {
        Args: {
          p_customer_email?: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_date: string;
          p_notes?: string;
          p_professional_id: string;
          p_service_id: string;
          p_slug: string;
          p_start_time: string;
        };
        Returns: string;
      };
      generate_company_slug: { Args: { p_name: string }; Returns: string };
      get_available_slots: {
        Args: {
          p_company_id: string;
          p_date: string;
          p_professional_id: string;
          p_service_id: string;
          p_step_minutes?: number;
        };
        Returns: {
          slot_start: string;
        }[];
      };
      get_public_available_slots: {
        Args: { p_date: string; p_professional_id: string; p_service_id: string; p_slug: string };
        Returns: {
          slot_start: string;
        }[];
      };
      get_public_booking_page: { Args: { p_slug: string }; Returns: Json };
      has_company_role: {
        Args: {
          p_company_id: string;
          p_roles: Database["public"]["Enums"]["company_member_role"][];
        };
        Returns: boolean;
      };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      professional_id_for_current_user: { Args: { p_company_id: string }; Returns: string };
      sweep_subscription_lifecycle: {
        Args: Record<PropertyKey, never>;
        Returns: {
          company_id: string;
          new_status: Database["public"]["Enums"]["subscription_status"];
          old_status: Database["public"]["Enums"]["subscription_status"];
        }[];
      };
      user_company_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      write_audit_log: {
        Args: {
          p_action: string;
          p_company_id: string;
          p_metadata?: Json;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      appointment_status: "agendado" | "confirmado" | "concluido" | "cancelado";
      company_member_role: "owner" | "professional";
      subscription_status: "ativa" | "pendente" | "tolerancia" | "suspensa" | "cancelada";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["agendado", "confirmado", "concluido", "cancelado"],
      company_member_role: ["owner", "professional"],
      subscription_status: ["ativa", "pendente", "tolerancia", "suspensa", "cancelada"],
    },
  },
} as const;
