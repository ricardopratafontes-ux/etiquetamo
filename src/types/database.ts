/**
 * Tipos do banco de dados Supabase — EtiquetaMO
 * Gerado manualmente a partir do schema 001_initial_schema.sql
 */

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          settings?: Record<string, unknown>;
        };
      };
      categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          uses_label: boolean;
          uses_lot: boolean;
          uses_expiry: boolean;
          default_expiry_days: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          uses_label?: boolean;
          uses_lot?: boolean;
          uses_expiry?: boolean;
          default_expiry_days?: number | null;
        };
        Update: {
          name?: string;
          uses_label?: boolean;
          uses_lot?: boolean;
          uses_expiry?: boolean;
          default_expiry_days?: number | null;
        };
      };
      items: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string | null;
          name: string;
          code: string | null;
          barcode: string | null;
          source: "manual" | "spreadsheet" | "omie";
          omie_product_id: number | null;
          uses_label: boolean | null;
          uses_lot: boolean | null;
          uses_expiry: boolean | null;
          expiry_days: number | null;
          additional_info: string | null;
          unit: string | null;
          net_weight: string | null;
          storage_type: "refrigerado" | "congelado" | "ambiente" | null;
          uses_complementary_label: boolean | null;
          complementary_label_text: string | null;
          active: boolean;
          manual_override: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category_id?: string | null;
          name: string;
          code?: string | null;
          barcode?: string | null;
          source?: "manual" | "spreadsheet" | "omie";
          omie_product_id?: number | null;
          uses_label?: boolean | null;
          uses_lot?: boolean | null;
          uses_expiry?: boolean | null;
          expiry_days?: number | null;
          additional_info?: string | null;
          unit?: string | null;
          net_weight?: string | null;
          storage_type?: "refrigerado" | "congelado" | "ambiente" | null;
          uses_complementary_label?: boolean | null;
          complementary_label_text?: string | null;
          active?: boolean;
          manual_override?: boolean;
        };
        Update: {
          category_id?: string | null;
          name?: string;
          code?: string | null;
          barcode?: string | null;
          source?: "manual" | "spreadsheet" | "omie";
          uses_label?: boolean | null;
          uses_lot?: boolean | null;
          uses_expiry?: boolean | null;
          expiry_days?: number | null;
          additional_info?: string | null;
          unit?: string | null;
          net_weight?: string | null;
          storage_type?: "refrigerado" | "congelado" | "ambiente" | null;
          uses_complementary_label?: boolean | null;
          complementary_label_text?: string | null;
          active?: boolean;
          manual_override?: boolean;
        };
      };
      operators: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          active?: boolean;
        };
        Update: {
          name?: string;
          active?: boolean;
        };
      };
      print_history: {
        Row: {
          id: string;
          organization_id: string;
          item_id: string;
          operator_id: string;
          product_name: string;
          fabrication_date: string;
          expiry_date: string | null;
          lot: string | null;
          additional_info: string | null;
          quantity: number;
          printed_at: string;
          printer_info: string | null;
          reprint_of: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          item_id: string;
          operator_id: string;
          product_name: string;
          fabrication_date: string;
          expiry_date?: string | null;
          lot?: string | null;
          additional_info?: string | null;
          quantity?: number;
          printer_info?: string | null;
          reprint_of?: string | null;
        };
        Update: Record<string, never>;
      };
    };
  };
}

// Tipos auxiliares para uso no app
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
export type Item = Database["public"]["Tables"]["items"]["Row"];
export type ItemInsert = Database["public"]["Tables"]["items"]["Insert"];
export type ItemUpdate = Database["public"]["Tables"]["items"]["Update"];
export type Operator = Database["public"]["Tables"]["operators"]["Row"];
export type PrintRecord = Database["public"]["Tables"]["print_history"]["Row"];
