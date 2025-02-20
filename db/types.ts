export interface Database {
  public: {
    Tables: {
      business_profiles: {
        Row: {
          id: number
          business_name: string | null
          website_url: string
          owner_name: string | null
          owner_title: string | null
          owner_linkedin: string | null
          owner_email: string | null
          primary_email: string | null
          alternative_emails: string[] | null
          phone_number: string | null
          address: string | null
          unique_selling_points: string[] | null
          specialties: string[] | null
          awards: string[] | null
          year_established: string | null
          services: string[] | null
          technologies: string[] | null
          insurances_accepted: string[] | null
          certifications: string[] | null
          affiliations: string[] | null
          testimonial_highlights: string[] | null
          social_media_links: Record<string, string> | null
          outreach_status: string
          last_email_sent_at: string | null
          email_history: Array<{
            subject: string
            content: string
            sentAt: string
          }> | null
          source_url: string | null
          source_type: string | null
          scraped_at: string
          updated_at: string
          notes: string | null
        }
        Insert: {
          id?: number
          business_name?: string | null
          website_url: string
          owner_name?: string | null
          owner_title?: string | null
          owner_linkedin?: string | null
          owner_email?: string | null
          primary_email?: string | null
          alternative_emails?: string[] | null
          phone_number?: string | null
          address?: string | null
          unique_selling_points?: string[] | null
          specialties?: string[] | null
          awards?: string[] | null
          year_established?: string | null
          services?: string[] | null
          technologies?: string[] | null
          insurances_accepted?: string[] | null
          certifications?: string[] | null
          affiliations?: string[] | null
          testimonial_highlights?: string[] | null
          social_media_links?: Record<string, string> | null
          outreach_status?: string
          last_email_sent_at?: string | null
          email_history?: Array<{
            subject: string
            content: string
            sentAt: string
          }> | null
          source_url?: string | null
          source_type?: string | null
          scraped_at?: string
          updated_at?: string
          notes?: string | null
        }
        Update: {
          id?: number
          business_name?: string | null
          website_url?: string
          owner_name?: string | null
          owner_title?: string | null
          owner_linkedin?: string | null
          owner_email?: string | null
          primary_email?: string | null
          alternative_emails?: string[] | null
          phone_number?: string | null
          address?: string | null
          unique_selling_points?: string[] | null
          specialties?: string[] | null
          awards?: string[] | null
          year_established?: string | null
          services?: string[] | null
          technologies?: string[] | null
          insurances_accepted?: string[] | null
          certifications?: string[] | null
          affiliations?: string[] | null
          testimonial_highlights?: string[] | null
          social_media_links?: Record<string, string> | null
          outreach_status?: string
          last_email_sent_at?: string | null
          email_history?: Array<{
            subject: string
            content: string
            sentAt: string
          }> | null
          source_url?: string | null
          source_type?: string | null
          scraped_at?: string
          updated_at?: string
          notes?: string | null
        }
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
  }
} 