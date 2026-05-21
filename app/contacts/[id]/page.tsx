import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { createClient } from '@/lib/supabase-server'
import type { Contact, Company, Deal, Activity, User, NoteWithAuthor } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS, LIFECYCLE_STAGE_LABELS, LIFECYCLE_STAGE_COLORS, type LifecycleStage } from '@/lib/types'
import { ContactActivitiesSection } from './contact-activities-section'
import { ContactActions } from './contact-actions'
import { NotesSection } from '@/components/notes-section'
import { ContactMeetingsSection } from './contact-meetings-section'
import { LifecycleStageSelect } from './lifecycle-stage-select'
import { ContactOwnerSelect } from './contact-owner-select'
import { ContactTasksSection, type TaskWithRelations } from './contact-tasks-section'
import { LeadScoreBadge } from './lead-score-badge'

export const dynamic = 'force-dynamic'

const LEAD_SOURCE_LABELS: Record<string, string> = {
  website_estimate: 'Website Estimate',
  google_ads: 'Google Ads',
  referral: 'Referral',
  facebook_ad: 'Facebook Ad',
  phone_call: 'Direct Phone Call',
  email: 'Direct Email',
  storm_lead: 'Storm Lead',
  other: 'Other',
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
  realtor: 'Realtor',
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

async function getContact(id: string): Promise<Contact | null> {
  const { data } = await (supabase.from('contacts') as any)
    .select('*')
    .eq('id', id)
    .single()

  return data as Contact | null
}

async function getCompany(id: string): Promise<Company | null> {
  const { data } = await (supabase.from('companies') as any)
    .select('*')
    .eq('id', id)
    .single()

  return data as Company | null
}

async function getContactDeals(contactId: string): Promise<Deal[]> {
  const { data } = await (supabase.from('deals') as any)
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  return (data as Deal[]) ?? []
}

async function getContactActivities(contactId: string): Promise<Activity[]> {
  const { data, error } = await (supabase.from('activities') as any)
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contact activities:', error)
    return []
  }

  console.log(`Fetched ${data?.length ?? 0} activities for contact ${contactId}`)
  return (data as Activity[]) ?? []
}

interface AttributionData {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  fbclid?: string | null
}

function getAttributionFromActivities(activities: Activity[]): AttributionData {
  // Look for UTM data in form_submit or meeting_scheduled activities (oldest first)
  const relevantActivities = activities
    .filter(a => a.activity_type === 'form_submit' || a.activity_type === 'meeting_scheduled')
    .reverse() // Get oldest first

  for (const activity of relevantActivities) {
    const metadata = activity.metadata as Record<string, unknown> | null
    if (metadata) {
      const utm_source = metadata.utm_source as string | undefined
      const utm_medium = metadata.utm_medium as string | undefined
      const utm_campaign = metadata.utm_campaign as string | undefined
      const fbclid = metadata.fbclid as string | undefined

      if (utm_source || utm_medium || utm_campaign || fbclid) {
        return { utm_source, utm_medium, utm_campaign, fbclid }
      }
    }
  }

  return {}
}

async function getContactNotes(contactId: string): Promise<NoteWithAuthor[]> {
  const serverSupabase = await createClient()
  const { data, error } = await (serverSupabase.from('notes') as any)
    .select('*, author:created_by(id, name)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contact notes:', error)
    return []
  }

  console.log(`Fetched ${data?.length ?? 0} notes for contact ${contactId}`)
  return (data as NoteWithAuthor[]) ?? []
}

async function getAllCompanies(): Promise<Pick<Company, 'id' | 'name' | 'type'>[]> {
  const { data } = await supabase
    .from('companies')
    .select('id, name, type')
    .order('name')

  return (data as Pick<Company, 'id' | 'name' | 'type'>[]) ?? []
}

async function getAllUsers(): Promise<User[]> {
  const { data } = await (supabase.from('users') as any)
    .select('id, email, name, avatar_url, role')
    .order('name')

  return (data as User[]) ?? []
}

async function getContactTasks(contactId: string): Promise<TaskWithRelations[]> {
  const { data } = await (supabase.from('tasks') as any)
    .select(`
      *,
      assigned_user:users!tasks_assigned_to_fkey(id, name),
      deal:deals(id, title)
    `)
    .eq('contact_id', contactId)
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (!data) return []

  return data.map((task: any) => ({
    ...task,
    contact_name: null,
    deal_title: task.deal?.title ?? null,
    company_name: null,
    assigned_user_name: task.assigned_user?.name ?? null,
  }))
}

async function getContactDealsForTasks(contactId: string): Promise<Pick<Deal, 'id' | 'title'>[]> {
  const { data } = await (supabase.from('deals') as any)
    .select('id, title')
    .eq('contact_id', contactId)
    .order('title')

  return data ?? []
}

async function getCurrentUserId(): Promise<string | undefined> {
  const serverSupabase = await createClient()
  const { data: { user: supabaseUser } } = await serverSupabase.auth.getUser()

  if (!supabaseUser?.email) return undefined

  const { data: crmUser } = await (supabase
    .from('users') as any)
    .select('id')
    .eq('email', supabaseUser.email)
    .single()

  return crmUser?.id
}

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: Promise<{ from?: string }>
}) {
  const [contact, resolvedSearchParams] = await Promise.all([
    getContact(params.id),
    searchParams,
  ])

  if (!contact) {
    notFound()
  }

  const [company, deals, activities, notes, allCompanies, allUsers, tasks, dealsForTasks, currentUserId] = await Promise.all([
    contact.company_id ? getCompany(contact.company_id) : null,
    getContactDeals(contact.id),
    getContactActivities(contact.id),
    getContactNotes(contact.id),
    getAllCompanies(),
    getAllUsers(),
    getContactTasks(contact.id),
    getContactDealsForTasks(contact.id),
    getCurrentUserId(),
  ])

  const totalDealValue = deals.reduce((sum, deal) => sum + (deal.value ?? 0), 0)
  const attribution = getAttributionFromActivities(activities)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pt-14 md:pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Link
              href={resolvedSearchParams.from === 'tasks' ? '/tasks' : '/contacts'}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← {resolvedSearchParams.from === 'tasks' ? 'Back to Tasks' : 'Back to Contacts'}
            </Link>
            <ContactActions contact={contact} companies={allCompanies} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                {contact.first_name} {contact.last_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {contact.lead_source && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-brand-100 text-brand-800">
                    {LEAD_SOURCE_LABELS[contact.lead_source] || contact.lead_source}
                  </span>
                )}
                {contact.client_type && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {CLIENT_TYPE_LABELS[contact.client_type] || contact.client_type}
                  </span>
                )}
                {contact.is_primary && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    Primary Contact
                  </span>
                )}
                <LeadScoreBadge
                  contactId={contact.id}
                  initialScore={contact.lead_score}
                  initialReason={contact.lead_score_reason}
                />
              </div>
              <div className="mt-3">
                <LifecycleStageSelect
                  contactId={contact.id}
                  currentStage={contact.lifecycle_stage as LifecycleStage | null}
                />
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl sm:text-3xl font-semibold text-gray-900">
                {deals.length}
              </p>
              <p className="text-sm text-gray-500">
                {deals.length === 1 ? 'Deal' : 'Deals'} · {formatCurrency(totalDealValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Contact Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Contact Info</h2>
              <dl className="space-y-3 text-sm">
                {contact.email && (
                  <div>
                    <dt className="text-gray-500">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-brand-600 hover:underline"
                      >
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd>
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-brand-600 hover:underline"
                      >
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {company && (
                  <div>
                    <dt className="text-gray-500">Company</dt>
                    <dd>
                      <Link
                        href={`/companies/${company.id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {company.name}
                      </Link>
                    </dd>
                  </div>
                )}
                {contact.role && (
                  <div>
                    <dt className="text-gray-500">Role</dt>
                    <dd className="text-gray-900">{contact.role}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-gray-900">{formatDate(contact.created_at)}</dd>
                </div>
                <ContactOwnerSelect
                  contactId={contact.id}
                  currentOwnerId={contact.owner_id}
                  users={allUsers}
                />
              </dl>
            </div>

            {/* Attribution / Source */}
            {(contact.lead_source || contact.fbclid || attribution.utm_source || attribution.utm_campaign) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="font-medium text-gray-900 mb-3">Attribution</h2>
                <dl className="space-y-2 text-sm">
                  {contact.lead_source && (
                    <div>
                      <dt className="text-gray-500">Source</dt>
                      <dd className="text-gray-900">
                        {LEAD_SOURCE_LABELS[contact.lead_source] || contact.lead_source}
                      </dd>
                    </div>
                  )}
                  {(contact.fbclid || attribution.fbclid) && (
                    <div>
                      <dt className="text-gray-500">Ad Platform</dt>
                      <dd className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        <span className="text-gray-900">Facebook Ad</span>
                      </dd>
                    </div>
                  )}
                  {attribution.utm_source && (
                    <div>
                      <dt className="text-gray-500">UTM Source</dt>
                      <dd className="text-gray-900">{attribution.utm_source}</dd>
                    </div>
                  )}
                  {attribution.utm_medium && (
                    <div>
                      <dt className="text-gray-500">UTM Medium</dt>
                      <dd className="text-gray-900">{attribution.utm_medium}</dd>
                    </div>
                  )}
                  {attribution.utm_campaign && (
                    <div>
                      <dt className="text-gray-500">UTM Campaign</dt>
                      <dd className="text-gray-900 break-words">{attribution.utm_campaign}</dd>
                    </div>
                  )}
                  {contact.fb_lead_id && (
                    <div>
                      <dt className="text-gray-500">FB Lead ID</dt>
                      <dd className="text-gray-500 text-xs font-mono truncate" title={contact.fb_lead_id}>
                        {contact.fb_lead_id}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Associated Deals */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Deals</h2>
              {deals.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No deals yet
                </p>
              ) : (
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {deal.title}
                          </p>
                          <span className={`inline-flex mt-1 px-1.5 py-0.5 text-xs font-medium rounded ${STAGE_COLORS[deal.stage]}`}>
                            {STAGE_LABELS[deal.stage]}
                          </span>
                        </div>
                        {deal.value && (
                          <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                            {formatCurrency(deal.value)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tasks */}
            <ContactTasksSection
              contactId={contact.id}
              tasks={tasks}
              users={allUsers}
              deals={dealsForTasks}
              currentUserId={currentUserId}
              contactOwnerId={contact.owner_id}
            />

            {/* Meetings */}
            <ContactMeetingsSection contactId={contact.id} />
          </div>

          {/* Right Column - Notes & Activities */}
          <div className="lg:col-span-2 space-y-6">
            <NotesSection
              contactId={contact.id}
              notes={notes}
              currentUserId={currentUserId}
            />
            <ContactActivitiesSection
              contactId={contact.id}
              activities={activities}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
