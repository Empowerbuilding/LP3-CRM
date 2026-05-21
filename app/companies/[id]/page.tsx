import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { createClient } from '@/lib/supabase-server'
import type { Company, Contact, Deal, Activity, ClientType, DealType, ActivityType, NoteWithAuthor } from '@/lib/types'
import { isDealWon, isDealInPipeline } from '@/lib/types'
import { CompanyActions } from './company-actions'
import { NotesSection } from '@/components/notes-section'
import { CompanyDealsSection } from './company-deals-section'

export const dynamic = 'force-dynamic'

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
  realtor: 'Realtor',
}

const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  builder: 'bg-brand-100 text-brand-800',
  consumer: 'bg-green-100 text-green-800',
  subcontractor: 'bg-orange-100 text-orange-800',
  engineer: 'bg-purple-100 text-purple-800',
  architect: 'bg-pink-100 text-pink-800',
  realtor: 'bg-teal-100 text-teal-800',
}

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  new_construction: 'New Construction',
  remodel: 'Remodel',
  addition: 'Addition',
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  page_view: '👁️',
  form_submit: '📋',
  email_sent: '✉️',
  sms_sent: '💬',
  call: '📞',
  note: '📝',
  stage_change: '🔄',
  deal_created: '🤝',
  contact_created: '👤',
  meeting_scheduled: '📅',
  meeting_cancelled: '❌',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateString?: string | null): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type DealWithContact = Deal & { contacts: { first_name: string; last_name: string } | null }
type ActivityWithRelations = Activity & {
  contacts: { first_name: string; last_name: string } | null
  deals: { title: string } | null
  user: { name: string } | null
}

async function getCompany(id: string): Promise<Company | null> {
  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  return data as Company | null
}

async function getContacts(companyId: string): Promise<Contact[]> {
  const { data } = await (supabase.from('contacts') as any)
    .select('*')
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('first_name')

  return (data as Contact[]) ?? []
}

async function getDeals(companyId: string): Promise<DealWithContact[]> {
  const { data } = await (supabase.from('deals') as any)
    .select('*, contacts(first_name, last_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (data as DealWithContact[]) ?? []
}

async function getActivities(companyId: string): Promise<ActivityWithRelations[]> {
  const { data } = await (supabase.from('activities') as any)
    .select('*, contacts(first_name, last_name), deals(title), user:user_id(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data as ActivityWithRelations[]) ?? []
}

async function getCompanyNotes(companyId: string): Promise<NoteWithAuthor[]> {
  const { data, error } = await (supabase.from('notes') as any)
    .select('*, author:created_by(id, name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching company notes:', error)
    return []
  }

  console.log(`Fetched ${data?.length ?? 0} notes for company ${companyId}`)
  return (data as NoteWithAuthor[]) ?? []
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

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [company, contacts, deals, activities, notes, currentUserId] = await Promise.all([
    getCompany(params.id),
    getContacts(params.id),
    getDeals(params.id),
    getActivities(params.id),
    getCompanyNotes(params.id),
    getCurrentUserId(),
  ])

  if (!company) {
    notFound()
  }

  // Calculate revenue from won deals (contract_signed, job_in_progress, completed)
  const totalRevenue = deals
    .filter((d) => isDealWon(d.stage))
    .reduce((sum, d) => sum + (d.value ?? 0), 0)

  // Calculate open deals value (in pipeline, not yet won)
  const openDealsValue = deals
    .filter((d) => isDealInPipeline(d.stage))
    .reduce((sum, d) => sum + (d.value ?? 0), 0)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto pt-14 md:pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/companies"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Companies
            </Link>
            <CompanyActions company={company} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{company.name}</h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2 ${CLIENT_TYPE_COLORS[company.type]}`}
              >
                {CLIENT_TYPE_LABELS[company.type]}
              </span>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-semibold text-green-600">
                {formatCurrency(totalRevenue)}
              </p>
              {openDealsValue > 0 && (
                <p className="text-sm text-gray-500">
                  {formatCurrency(openDealsValue)} in pipeline
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Company Info & Contacts */}
          <div className="lg:col-span-1 space-y-6">
            {/* Company Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Company Info</h2>
              <dl className="space-y-2 text-sm">
                {company.phone && (
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="text-gray-900">{company.phone}</dd>
                  </div>
                )}
                {company.website && (
                  <div>
                    <dt className="text-gray-500">Website</dt>
                    <dd>
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        {company.website}
                      </a>
                    </dd>
                  </div>
                )}
                {(company.address || company.city || company.state) && (
                  <div>
                    <dt className="text-gray-500">Address</dt>
                    <dd className="text-gray-900">
                      {company.address && <span>{company.address}<br /></span>}
                      {company.city}{company.city && company.state && ', '}{company.state}
                    </dd>
                  </div>
                )}
                {company.notes && (
                  <div>
                    <dt className="text-gray-500">Notes</dt>
                    <dd className="text-gray-900 whitespace-pre-wrap">{company.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Contacts */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">
                Contacts ({contacts.length})
              </h2>
              {contacts.length === 0 ? (
                <p className="text-sm text-gray-500">No contacts yet</p>
              ) : (
                <ul className="space-y-3">
                  {contacts.map((contact) => (
                    <li key={contact.id} className="flex items-start gap-3">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0 hover:bg-gray-300 transition-colors"
                      >
                        {contact.first_name[0]}{contact.last_name[0]}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors"
                        >
                          {contact.first_name} {contact.last_name}
                          {contact.is_primary && (
                            <span className="ml-2 text-xs text-brand-600">Primary</span>
                          )}
                        </Link>
                        {contact.role && (
                          <p className="text-xs text-gray-500">{contact.role}</p>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-xs text-brand-600 hover:underline block truncate"
                          >
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <p className="text-xs text-gray-500">{contact.phone}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Column - Notes, Deals & Activities */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notes */}
            <NotesSection
              companyId={company.id}
              notes={notes}
              currentUserId={currentUserId}
            />

            {/* Deals */}
            <CompanyDealsSection
              companyId={company.id}
              companyName={company.name}
              deals={deals}
              contacts={contacts}
            />

            {/* Activity Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Recent Activity</h2>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-500">No activity yet</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                        {ACTIVITY_ICONS[activity.activity_type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {activity.title}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-gray-600 mt-0.5">
                                {activity.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              {activity.contacts && (
                                <span>
                                  {activity.contacts.first_name} {activity.contacts.last_name}
                                </span>
                              )}
                              {activity.contacts && activity.deals && <span>•</span>}
                              {activity.deals && <span>{activity.deals.title}</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-xs text-gray-500">
                              {formatDateTime(activity.created_at)}
                            </p>
                            {activity.user && (
                              <p className="text-xs text-gray-400">
                                by {activity.user.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
