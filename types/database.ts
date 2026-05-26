/**
 * Database types — regenerate with `npm run supabase:types` after migrations change.
 * This file is a hand-written placeholder; replace with generated types in production.
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          whatsapp_number: string | null;
          role: "plumber" | "homeowner" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      plumbers: {
        Row: {
          id: string;
          profile_id: string;
          trading_name: string;
          slug: string | null;
          area: string;
          hourly_rate: number | null;
          about: string | null;
          specialties: string[];
          is_emergency: boolean;
          availability_status: "available" | "busy" | "unavailable";
          google_calendar_url: string | null;
          google_place_id: string | null;
          pirb_number: string | null;
          is_certified: boolean;
          is_verified: boolean;
          google_rating: number | null;
          google_review_count: number | null;
          google_reviews_synced_at: string | null;
          whatsapp_number: string;
          profile_views: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["plumbers"]["Row"],
          "id" | "created_at" | "updated_at" | "profile_views" | "slug"
        > & {
          id?: string;
          slug?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plumbers"]["Row"]>;
      };
      certifications: {
        Row: {
          id: string;
          plumber_id: string;
          cert_name: string;
          cert_file_url: string;
          uploaded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["certifications"]["Row"], "id" | "uploaded_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["certifications"]["Row"]>;
      };
      photos: {
        Row: {
          id: string;
          plumber_id: string;
          photo_url: string;
          is_profile_photo: boolean;
          caption: string | null;
          uploaded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["photos"]["Row"], "id" | "uploaded_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photos"]["Row"]>;
      };
      reviews: {
        Row: {
          id: string;
          plumber_id: string;
          reviewer_id: string | null;
          reviewer_name: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reviews"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Row"]>;
      };
      google_reviews: {
        Row: {
          id: string;
          plumber_id: string;
          reviewer_name: string;
          rating: number;
          text: string | null;
          google_author_url: string | null;
          profile_photo_url: string | null;
          review_time: string | null;
          cached_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["google_reviews"]["Row"], "id" | "cached_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_reviews"]["Row"]>;
      };
      bookings: {
        Row: {
          id: string;
          plumber_id: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          job_description: string;
          preferred_datetime: string;
          status: "pending" | "confirmed" | "cancelled";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bookings"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
      };
    };
    Views: {
      plumber_ratings: {
        Row: {
          plumber_id: string;
          google_rating: number;
          google_count: number;
          internal_rating: number;
          internal_count: number;
          combined_rating: number | null;
          combined_count: number;
        };
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "plumber" | "homeowner" | "admin";
      availability_status: "available" | "busy" | "unavailable";
      booking_status: "pending" | "confirmed" | "cancelled";
    };
  };
};

export type Plumber = Database["public"]["Tables"]["plumbers"]["Row"] & {
  profile?: Database["public"]["Tables"]["profiles"]["Row"];
  ratings?: Database["public"]["Views"]["plumber_ratings"]["Row"];
  photos?: Array<{ photo_url: string; is_profile_photo: boolean }>;
  certifications?: Array<{ id: string; cert_name: string }>;
};
