// Enum types matching your business domain
export type ClientType = 'builder' | 'consumer' | 'subcontractor' | 'engineer' | 'architect' | 'realtor'

export type DealType = 'insurance_claim' | 'retail_cash' | 'financing' | 'commercial' | 'repair' | 'new_construction'

// Roofing pipeline stages (linear progression)
export type PipelineStage =
  | 'new_lead'
  | 'inspection_scheduled'
  | 'inspection_complete'
  | 'estimate_sent'
  | 'insurance_filed'
  | 'adjuster_meeting'
  | 'approved'
  | 'contract_signed'
  | 'material_ordered'
  | 'job_scheduled'
  | 'job_in_progress'
  | 'completed'
  | 'collected'
  | 'lost'

// All pipeline stages in order
export const PIPELINE_STAGES: PipelineStage[] = [
  'new_lead',
  'inspection_scheduled',
  'inspection_complete',
  'estimate_sent',
  'insurance_filed',
  'adjuster_meeting',
  'approved',
  'contract_signed',
  'material_ordered',
  'job_scheduled',
  'job_in_progress',
  'completed',
  'collected',
  'lost',
]

// Stages that count as "pipeline" (potential deals not yet won)
export const PIPELINE_ACTIVE_STAGES: PipelineStage[] = [
  'new_lead',
  'inspection_scheduled',
  'inspection_complete',
  'estimate_sent',
  'insurance_filed',
  'adjuster_meeting',
  'approved',
]

// Stages that count as "won" (deal converted to customer)
export const WON_STAGES: PipelineStage[] = [
  'contract_signed',
  'material_ordered',
  'job_scheduled',
  'job_in_progress',
  'completed',
  'collected',
]

// Check if a deal is won (contract signed or beyond)
export function isDealWon(stage: PipelineStage): boolean {
  return WON_STAGES.includes(stage)
}

// Check if a deal is in active pipeline (not won, not lost)
export function isDealInPipeline(stage: PipelineStage): boolean {
  return PIPELINE_ACTIVE_STAGES.includes(stage)
}

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new_lead: 'New Lead',
  inspection_scheduled: 'Inspection Scheduled',
  inspection_complete: 'Inspection Complete',
  estimate_sent: 'Estimate Sent',
  insurance_filed: 'Insurance Filed',
  adjuster_meeting: 'Adjuster Meeting',
  approved: 'Approved',
  contract_signed: 'Contract Signed',
  material_ordered: 'Material Ordered',
  job_scheduled: 'Job Scheduled',
  job_in_progress: 'Job In Progress',
  completed: 'Completed',
  collected: 'Collected',
  lost: 'Lost',
}

export const STAGE_COLORS: Record<PipelineStage, string> = {
  new_lead: 'bg-brand-100 text-brand-800',
  inspection_scheduled: 'bg-cyan-100 text-cyan-800',
  inspection_complete: 'bg-sky-100 text-sky-800',
  estimate_sent: 'bg-indigo-100 text-indigo-800',
  insurance_filed: 'bg-violet-100 text-violet-800',
  adjuster_meeting: 'bg-purple-100 text-purple-800',
  approved: 'bg-yellow-100 text-yellow-800',
  contract_signed: 'bg-orange-100 text-orange-800',
  material_ordered: 'bg-amber-100 text-amber-800',
  job_scheduled: 'bg-lime-100 text-lime-800',
  job_in_progress: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  collected: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
}

export type LeadSource =
  | 'website_estimate'
  | 'facebook_ad'
  | 'google_ads'
  | 'door_knock'
  | 'storm_lead'
  | 'referral'
  | 'insurance_adjuster'
  | 'repeat_customer'
  | 'yard_sign'
  | 'phone_call'
  | 'other'

export type LifecycleStage = 'subscriber' | 'lead' | 'mql' | 'sql' | 'customer'

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  subscriber: 'Subscriber',
  lead: 'Lead',
  mql: 'Marketing Qualified',
  sql: 'Sales Qualified',
  customer: 'Customer',
}

export const LIFECYCLE_STAGE_COLORS: Record<LifecycleStage, string> = {
  subscriber: 'bg-gray-100 text-gray-800',
  lead: 'bg-brand-100 text-brand-800',
  mql: 'bg-purple-100 text-purple-800',
  sql: 'bg-orange-100 text-orange-800',
  customer: 'bg-green-100 text-green-800',
}

export type ActivityType =
  | 'page_view'
  | 'form_submit'
  | 'email_sent'
  | 'sms_sent'
  | 'call'
  | 'note'
  | 'stage_change'
  | 'deal_created'
  | 'contact_created'
  | 'meeting_scheduled'
  | 'meeting_cancelled'

export type UserRole = 'admin' | 'sales'

// Table row types
export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: UserRole
  created_at?: string
}

export interface Company {
  id: string
  name: string
  type: ClientType
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  notes: string | null
  meeting_scheduled_at: string | null
  created_at?: string
  updated_at?: string
}

export interface Contact {
  id: string
  company_id: string | null
  owner_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean
  lead_source: LeadSource | null
  client_type: ClientType | null
  lifecycle_stage: LifecycleStage | null
  fb_events_sent: Record<string, string> | null
  fbclid: string | null
  fb_lead_id: string | null
  fbp: string | null
  client_ip_address: string | null
  client_user_agent: string | null
  anonymous_id: string | null
  notes: string | null
  unsubscribed: boolean
  unsubscribed_at: string | null
  lead_score: 'hot' | 'medium' | 'cold' | null
  lead_score_reason: string | null
  lead_score_updated_at: string | null
  meeting_scheduled_at: string | null
  created_at?: string
  updated_at?: string
}

export interface Deal {
  id: string
  company_id: string | null
  contact_id: string | null
  owner_id: string | null
  title: string
  value: number | null
  stage: PipelineStage
  deal_type: DealType | null
  probability: number | null
  expected_close_date: string | null
  actual_close_date: string | null
  lost_reason: string | null
  notes: string | null
  meeting_scheduled_at: string | null
  created_at?: string
  updated_at?: string
}

export interface Activity {
  id: string
  contact_id: string | null
  deal_id: string | null
  company_id: string | null
  user_id: string | null
  activity_type: ActivityType
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  anonymous_id: string | null
  created_at: string
}

// Task types
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'to_do' | 'call' | 'email' | 'meeting' | 'follow_up'

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
export const TASK_TYPES: TaskType[] = ['to_do', 'call', 'email', 'meeting', 'follow_up']

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  to_do: 'To Do',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  follow_up: 'Follow Up',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-brand-100 text-brand-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
}

export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  to_do: 'bg-gray-100 text-gray-800',
  call: 'bg-green-100 text-green-800',
  email: 'bg-brand-100 text-brand-800',
  meeting: 'bg-purple-100 text-purple-800',
  follow_up: 'bg-yellow-100 text-yellow-800',
}

export interface Task {
  id: string
  contact_id: string | null
  deal_id: string | null
  company_id: string | null
  assigned_to: string | null
  created_by: string | null
  title: string
  description: string | null
  priority: TaskPriority
  task_type: TaskType
  due_date: string | null
  due_time: string | null
  reminder_at: string | null
  completed: boolean
  completed_at: string | null
  meeting_scheduled_at: string | null
  created_at?: string
  updated_at?: string
}

export interface TaskWithRelations extends Task {
  contact?: Contact | null
  deal?: Deal | null
  company?: Company | null
  assigned_user?: User | null
  created_user?: User | null
}

// Note types
export interface Note {
  id: string
  contact_id: string | null
  deal_id: string | null
  company_id: string | null
  task_id: string | null
  content: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface NoteWithAuthor extends Note {
  author?: {
    id: string
    name: string
  } | null
}

export interface DealValueHistory {
  id: string
  deal_id: string
  value: number
  note: string | null
  created_at: string
}

// Linked deals types
export type DealRelationshipType = 'referral_source' | 'referral_generated' | 'same_client'

export const RELATIONSHIP_LABELS: Record<DealRelationshipType, string> = {
  referral_source: 'Referral Source',
  referral_generated: 'Generated Referral',
  same_client: 'Same Client',
}

export const RELATIONSHIP_DESCRIPTIONS: Record<DealRelationshipType, string> = {
  referral_source: 'This deal led to the linked deal',
  referral_generated: 'This deal was generated from the linked deal',
  same_client: 'Both deals are for the same client',
}

// Get the inverse relationship type (for bidirectional linking)
export function getInverseRelationship(type: DealRelationshipType): DealRelationshipType {
  switch (type) {
    case 'referral_source':
      return 'referral_generated'
    case 'referral_generated':
      return 'referral_source'
    case 'same_client':
      return 'same_client'
  }
}

export interface LinkedDeal {
  id: string
  deal_id: string
  linked_deal_id: string
  relationship_type: DealRelationshipType
  created_at: string
}

export interface LinkedDealWithDetails extends LinkedDeal {
  linked_deal: Deal & {
    company_name?: string | null
  }
}

// Joined types for queries
export interface DealWithRelations extends Deal {
  company?: Company | null
  contact?: Contact | null
}

export interface ActivityWithRelations extends Activity {
  deal?: Deal | null
  contact?: Contact | null
  company?: Company | null
  user?: User | null
}

// Supabase Database type for client
export interface Database {
  public: {
    Tables: {
      companies: {
        Row: Company
        Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Company, 'id'>>
        Relationships: []
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Contact, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'contacts_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          }
        ]
      }
      deals: {
        Row: Deal
        Insert: Omit<Deal, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Deal, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'deals_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deals_contact_id_fkey'
            columns: ['contact_id']
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          }
        ]
      }
      activities: {
        Row: Activity
        Insert: Omit<Activity, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Activity, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'activities_contact_id_fkey'
            columns: ['contact_id']
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
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

// Pipeline summary type for dashboard
export interface PipelineSummary {
  stage: PipelineStage
  count: number
  total_value: number
}

// ============================================
// Calendar / Meeting Scheduler Types
// ============================================

// Calendar Integration (Google OAuth connection)
export interface CalendarIntegration {
  id: string
  user_id: string
  provider: string
  email_address: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  calendar_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Custom field definition for meeting types
export interface MeetingTypeCustomField {
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required: boolean
  options?: string[] // for select type
}

// Meeting Type location options
export type MeetingLocationType = 'google_meet' | 'phone' | 'in_person' | 'custom'

// Meeting Type (bookable meeting link)
export interface MeetingType {
  id: string
  user_id: string
  slug: string
  title: string
  description: string | null
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  availability_start: string // "HH:MM" format
  availability_end: string
  available_days: number[] // 0=Sun, 1=Mon, etc.
  timezone: string
  max_days_ahead: number
  min_notice_hours: number
  is_active: boolean
  location_type: MeetingLocationType
  custom_location: string | null
  custom_fields: MeetingTypeCustomField[]
  confirmation_message: string | null
  brand_color: string
  logo_url: string | null
  created_at: string
  updated_at: string
}

// Scheduled Meeting status
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled'

// Scheduled Meeting (booked appointment)
export interface ScheduledMeeting {
  id: string
  meeting_type_id: string | null
  host_user_id: string
  contact_id: string | null
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string | null
  guest_notes: string | null
  custom_field_responses: Record<string, unknown>
  start_time: string
  end_time: string
  timezone: string
  google_event_id: string | null
  google_meet_link: string | null
  status: MeetingStatus
  cancelled_at: string | null
  cancellation_reason: string | null
  rescheduled_from: string | null
  anonymous_id: string | null
  source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

// Scheduled Meeting with relations
export interface ScheduledMeetingWithRelations extends ScheduledMeeting {
  meeting_type?: MeetingType | null
  host_user?: User | null
  contact?: Contact | null
}

// Time slot for availability
export interface TimeSlot {
  start: Date
  end: Date
}

// Formatted time slot (for API responses)
export interface FormattedTimeSlot {
  start: string
  end: string
  startFormatted: string
  endFormatted: string
}

// API response types for calendar/booking
export interface AvailabilityResponse {
  meetingType: {
    title: string
    description: string | null
    duration_minutes: number
    location_type: MeetingLocationType
    custom_fields: MeetingTypeCustomField[]
    brand_color: string
    timezone: string
  }
  host: { name: string }
  date: string
  timezone: string
  slots: FormattedTimeSlot[]
}

export interface AvailableDatesResponse {
  dates: string[]
}

export interface BookingResponse {
  success: boolean
  meeting: {
    id: string
    startTime: string
    endTime: string
    title: string
    hostName: string
    googleMeetLink?: string
    timezone: string
  }
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}
