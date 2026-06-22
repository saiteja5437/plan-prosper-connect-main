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
      actual_hours: {
        Row: {
          allocation_id: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          hours: number
          id: string
          project_id: string
          resource_id: string
          status: string
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        Insert: {
          allocation_id: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hours?: number
          id?: string
          project_id: string
          resource_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_date: string
        }
        Update: {
          allocation_id?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hours?: number
          id?: string
          project_id?: string
          resource_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "actual_hours_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_hours_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "actual_hours_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_hours_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          allocation_percent: number
          billing_rate: number
          cost_rate: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          end_date: string
          id: string
          is_billable: boolean
          is_deleted: boolean
          notes: string | null
          planned_hours: number
          project_id: string
          resource_id: string
          role: string | null
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allocation_percent?: number
          billing_rate?: number
          cost_rate?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          end_date: string
          id?: string
          is_billable?: boolean
          is_deleted?: boolean
          notes?: string | null
          planned_hours?: number
          project_id: string
          resource_id: string
          role?: string | null
          start_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allocation_percent?: number
          billing_rate?: number
          cost_rate?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string
          id?: string
          is_billable?: boolean
          is_deleted?: boolean
          notes?: string | null
          planned_hours?: number
          project_id?: string
          resource_id?: string
          role?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          is_deleted: boolean
          module_name: string
          record_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
          version_no: number
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_deleted?: boolean
          module_name: string
          record_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string
          version_no?: number
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_deleted?: boolean
          module_name?: string
          record_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
          version_no?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          field_name: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          module_name: string
          new_value: string | null
          old_value: string | null
          record_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field_name?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module_name: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field_name?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module_name?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      business_rules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rule_key: string
          updated_at: string
          value: Json
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rule_key: string
          updated_at?: string
          value: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rule_key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          is_deleted: boolean
          is_primary: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_deleted?: boolean
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_deleted?: boolean
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_owner_id: string | null
          billing_address: Json | null
          code: string
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          currency: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          industry: string | null
          is_deleted: boolean
          legal_name: string | null
          metadata: Json | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          region: string | null
          segment: string | null
          shipping_address: Json | null
          status: string
          tags: string[] | null
          tax_id: string | null
          tier: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          account_owner_id?: string | null
          billing_address?: Json | null
          code: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_deleted?: boolean
          legal_name?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          region?: string | null
          segment?: string | null
          shipping_address?: Json | null
          status?: string
          tags?: string[] | null
          tax_id?: string | null
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          account_owner_id?: string | null
          billing_address?: Json | null
          code?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_deleted?: boolean
          legal_name?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          region?: string | null
          segment?: string | null
          shipping_address?: Json | null
          status?: string
          tags?: string[] | null
          tax_id?: string | null
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_deleted: boolean
          mentioned_users: string[] | null
          module_name: string
          record_id: string
          reply_to_comment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          mentioned_users?: string[] | null
          module_name: string
          record_id: string
          reply_to_comment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          mentioned_users?: string[] | null
          module_name?: string
          record_id?: string
          reply_to_comment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_reply_to_comment_id_fkey"
            columns: ["reply_to_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number | null
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number | null
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          is_deleted: boolean
          milestone_id: string | null
          notes: string | null
          paid_on: string | null
          period_end: string | null
          period_start: string | null
          project_id: string
          status: string
          subtotal: number
          tax_amount: number
          tax_percent: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_paid?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          is_deleted?: boolean
          milestone_id?: string | null
          notes?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          project_id: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_paid?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_deleted?: boolean
          milestone_id?: string | null
          notes?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          project_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_values: {
        Row: {
          code: string
          color: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_by: string | null
          deleted_on: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          label: string
          lookup_id: string
          metadata: Json | null
          modified_by: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          label: string
          lookup_id: string
          metadata?: Json | null
          modified_by?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          label?: string
          lookup_id?: string
          metadata?: Json | null
          modified_by?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lookup_values_lookup_id_fkey"
            columns: ["lookup_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
      lookups: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_by: string | null
          deleted_on: string | null
          description: string | null
          id: string
          is_deleted: boolean
          is_system: boolean
          modified_by: string | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_system?: boolean
          modified_by?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_by?: string | null
          deleted_on?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_system?: boolean
          modified_by?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          actual_date: string | null
          billing_amount: number | null
          billing_currency: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_billing_milestone: boolean
          is_deleted: boolean
          name: string
          planned_date: string
          project_id: string
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_date?: string | null
          billing_amount?: number | null
          billing_currency?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_billing_milestone?: boolean
          is_deleted?: boolean
          name: string
          planned_date: string
          project_id: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_date?: string | null
          billing_amount?: number | null
          billing_currency?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_billing_milestone?: boolean
          is_deleted?: boolean
          name?: string
          planned_date?: string
          project_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          link: string | null
          message: string | null
          module_name: string | null
          priority: string
          record_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          link?: string | null
          message?: string | null
          module_name?: string | null
          priority?: string
          record_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          link?: string | null
          message?: string | null
          module_name?: string | null
          priority?: string
          record_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      planned_hours: {
        Row: {
          allocation_id: string
          created_at: string
          created_by: string | null
          hours: number
          id: string
          notes: string | null
          project_id: string
          resource_id: string
          updated_at: string
          updated_by: string | null
          week_start: string
        }
        Insert: {
          allocation_id: string
          created_at?: string
          created_by?: string | null
          hours?: number
          id?: string
          notes?: string | null
          project_id: string
          resource_id: string
          updated_at?: string
          updated_by?: string | null
          week_start: string
        }
        Update: {
          allocation_id?: string
          created_at?: string
          created_by?: string | null
          hours?: number
          id?: string
          notes?: string | null
          project_id?: string
          resource_id?: string
          updated_at?: string
          updated_by?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_hours_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_hours_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "planned_hours_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_hours_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          practice: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          practice?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          practice?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          approved_budget: number | null
          billing_model: string
          business_unit: string | null
          client_id: string | null
          code: string
          contract_value: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          description: string | null
          end_date: string | null
          fixed_price_amount: number | null
          health: string
          id: string
          is_deleted: boolean
          name: string
          notes: string | null
          planned_budget: number | null
          priority: string | null
          project_manager_id: string | null
          region: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_budget?: number | null
          billing_model?: string
          business_unit?: string | null
          client_id?: string | null
          code: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          description?: string | null
          end_date?: string | null
          fixed_price_amount?: number | null
          health?: string
          id?: string
          is_deleted?: boolean
          name: string
          notes?: string | null
          planned_budget?: number | null
          priority?: string | null
          project_manager_id?: string | null
          region?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_budget?: number | null
          billing_model?: string
          business_unit?: string | null
          client_id?: string | null
          code?: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          description?: string | null
          end_date?: string | null
          fixed_price_amount?: number | null
          health?: string
          id?: string
          is_deleted?: boolean
          name?: string
          notes?: string | null
          planned_budget?: number | null
          priority?: string | null
          project_manager_id?: string | null
          region?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_rates: {
        Row: {
          billing_currency: string | null
          billing_rate: number | null
          cost_currency: string | null
          cost_rate: number | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          resource_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_currency?: string | null
          billing_rate?: number | null
          cost_currency?: string | null
          cost_rate?: number | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          resource_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_currency?: string | null
          billing_rate?: number | null
          cost_currency?: string | null
          cost_rate?: number | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          resource_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_rates_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          availability_status: string
          billing_currency: string | null
          certifications: string[] | null
          competency: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          cost_currency: string | null
          country: string | null
          created_at: string
          created_by: string | null
          default_billing_rate: number | null
          default_cost_rate: number | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          designation: string | null
          email: string
          employee_code: string
          employment_status: string
          exit_date: string | null
          first_name: string
          full_name: string | null
          hire_date: string | null
          id: string
          is_deleted: boolean
          job_title: string | null
          last_name: string
          location: string | null
          manager_id: string | null
          metadata: Json | null
          notes: string | null
          phone: string | null
          practice: string | null
          primary_skills: string[] | null
          region: string | null
          reports_to_id: string | null
          resource_type: string
          secondary_skills: string[] | null
          skill_level: string | null
          tags: string[] | null
          timezone: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          vendor_name: string | null
          weekly_capacity_hours: number
        }
        Insert: {
          availability_status?: string
          billing_currency?: string | null
          certifications?: string[] | null
          competency?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          cost_currency?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_billing_rate?: number | null
          default_cost_rate?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          designation?: string | null
          email: string
          employee_code: string
          employment_status?: string
          exit_date?: string | null
          first_name: string
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_deleted?: boolean
          job_title?: string | null
          last_name: string
          location?: string | null
          manager_id?: string | null
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          practice?: string | null
          primary_skills?: string[] | null
          region?: string | null
          reports_to_id?: string | null
          resource_type?: string
          secondary_skills?: string[] | null
          skill_level?: string | null
          tags?: string[] | null
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          vendor_name?: string | null
          weekly_capacity_hours?: number
        }
        Update: {
          availability_status?: string
          billing_currency?: string | null
          certifications?: string[] | null
          competency?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          cost_currency?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_billing_rate?: number | null
          default_cost_rate?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          designation?: string | null
          email?: string
          employee_code?: string
          employment_status?: string
          exit_date?: string | null
          first_name?: string
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_deleted?: boolean
          job_title?: string | null
          last_name?: string
          location?: string | null
          manager_id?: string | null
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          practice?: string | null
          primary_skills?: string[] | null
          region?: string | null
          reports_to_id?: string | null
          resource_type?: string
          secondary_skills?: string[] | null
          skill_level?: string | null
          tags?: string[] | null
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          vendor_name?: string | null
          weekly_capacity_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_reports_to_id_fkey"
            columns: ["reports_to_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          category: string | null
          closed_on: string | null
          code: string | null
          contingency_plan: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          identified_on: string
          impact: number
          is_deleted: boolean
          mitigation_plan: string | null
          owner_id: string | null
          probability: number
          project_id: string
          response_strategy: string | null
          risk_score: number | null
          status: string
          target_close_date: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          closed_on?: string | null
          code?: string | null
          contingency_plan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          identified_on?: string
          impact?: number
          is_deleted?: boolean
          mitigation_plan?: string | null
          owner_id?: string | null
          probability?: number
          project_id: string
          response_strategy?: string | null
          risk_score?: number | null
          status?: string
          target_close_date?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          closed_on?: string | null
          code?: string | null
          contingency_plan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          identified_on?: string
          impact?: number
          is_deleted?: boolean
          mitigation_plan?: string | null
          owner_id?: string | null
          probability?: number
          project_id?: string
          response_strategy?: string | null
          risk_score?: number | null
          status?: string
          target_close_date?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          is_shared: boolean
          module_name: string
          updated_at: string
          user_id: string
          view_name: string
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          is_default?: boolean
          is_shared?: boolean
          module_name: string
          updated_at?: string
          user_id: string
          view_name: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          is_shared?: boolean
          module_name?: string
          updated_at?: string
          user_id?: string
          view_name?: string
        }
        Relationships: []
      }
      security_rules: {
        Row: {
          created_at: string
          description: string | null
          filter_expression: string | null
          id: string
          is_read_only: boolean
          module_name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filter_expression?: string | null
          id?: string
          is_read_only?: boolean
          module_name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filter_expression?: string | null
          id?: string
          is_read_only?: boolean
          module_name?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      project_financials: {
        Row: {
          actual_cost: number | null
          actual_hours: number | null
          actual_margin: number | null
          actual_margin_percent: number | null
          actual_revenue: number | null
          approved_budget: number | null
          billing_model: string | null
          budget_consumed_percent: number | null
          budget_remaining: number | null
          code: string | null
          contract_value: number | null
          currency: string | null
          fixed_price_amount: number | null
          name: string | null
          planned_budget: number | null
          planned_cost: number | null
          planned_hours: number | null
          planned_revenue: number | null
          project_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "pmo_admin"
        | "project_manager"
        | "resource_manager"
        | "finance_manager"
        | "leadership"
        | "auditor"
        | "team_member"
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
    Enums: {
      app_role: [
        "super_admin",
        "pmo_admin",
        "project_manager",
        "resource_manager",
        "finance_manager",
        "leadership",
        "auditor",
        "team_member",
      ],
    },
  },
} as const
