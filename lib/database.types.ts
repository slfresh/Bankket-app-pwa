/**
 * Regenerate from your Supabase project after schema changes:
 * `npm run db:types` (requires [Supabase CLI](https://supabase.com/docs/guides/cli) and `supabase link`).
 */
export type UserRole = "manager" | "waiter" | "kitchen";
export type OrderStatus = "pending" | "cooked" | "served";
/** Banquet course for menu items and orders */
export type MenuCourse = "starter" | "main" | "dessert";
/** Room arrangement: round, long block, or L-shaped perimeter seating */
export type TableLayout = "round" | "block" | "l_shape";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Functions: {
      advance_order_status: {
        Args: { order_id: string; next_status: OrderStatus };
        Returns: undefined;
      };
    };
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: UserRole;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          name: string;
          event_date: string;
          room_location: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          event_date: string;
          room_location: string;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          event_date?: string;
          room_location?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          event_id: string;
          label: string;
          sort_order: number;
          course: MenuCourse;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          label: string;
          sort_order?: number;
          course?: MenuCourse;
        };
        Update: {
          label?: string;
          sort_order?: number;
          course?: MenuCourse;
        };
        Relationships: [];
      };
      banquet_tables: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          total_seats: number;
          layout: TableLayout;
          sort_order: number;
          floor_x: number | null;
          floor_y: number | null;
          floor_rotation: number;
          layout_config: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          total_seats: number;
          layout?: TableLayout;
          sort_order?: number;
          floor_x?: number | null;
          floor_y?: number | null;
          floor_rotation?: number;
          layout_config?: Json | null;
        };
        Update: {
          name?: string;
          total_seats?: number;
          layout?: TableLayout;
          sort_order?: number;
          floor_x?: number | null;
          floor_y?: number | null;
          floor_rotation?: number;
          layout_config?: Json | null;
        };
        Relationships: [];
      };
      order_audit_log: {
        Row: {
          id: string;
          order_id: string | null;
          event_id: string;
          table_id: string | null;
          actor_id: string | null;
          action: string;
          old_status: OrderStatus | null;
          new_status: OrderStatus | null;
          seat_number: number | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          event_id: string;
          table_id: string;
          seat_number: number;
          menu_item_id: string;
          course: MenuCourse;
          special_wishes: string | null;
          status: OrderStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          table_id: string;
          seat_number: number;
          menu_item_id: string;
          course?: MenuCourse;
          special_wishes?: string | null;
          status?: OrderStatus;
        };
        Update: {
          special_wishes?: string | null;
          status?: OrderStatus;
        };
        Relationships: [];
      };
      seat_guest_notes: {
        Row: {
          id: string;
          event_id: string;
          table_id: string;
          seat_number: number;
          kitchen_notice: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          table_id: string;
          seat_number: number;
          kitchen_notice?: string | null;
        };
        Update: {
          kitchen_notice?: string | null;
        };
        Relationships: [];
      };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      table_layout: TableLayout;
      menu_course: MenuCourse;
    };
  };
}
