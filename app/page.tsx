import { supabase } from '@/lib/supabase'
import type { Deal, Activity, PipelineStage } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS, isDealInPipeline, isDealWon } from '@/lib/types'
import LeadAnalytics, { type LeadData } from '@/components/lead-analytics'

export const dynamic = 'force-dynamic'

interface PipelineStats {
  pipeline: { count: number; value: number }
  won: { count: number; value: number }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

async function getPipelineStats(): Promise<PipelineStats> {
  const { data: deals } = await (supabase.from('deals') as any)
    .select('stage, value')

  if (!deals) {
    return {
      pipeline: { count: 0, value: 0 },
      won: { count: 0, value: 0 },
    }
  }

  // Pipeline: deals in active pipeline stages (not yet won, not lost)
  const pipelineDeals = deals.filter(
    (d: any) => isDealInPipeline(d.stage)
  )
  // Won: deals that have been converted (contract_signed, job_in_progress, completed)
  const wonDeals = deals.filter(
    (d: any) => isDealWon(d.stage)
  )

  const sumValue = (arr: any[]) => arr.reduce((sum: number, d: any) => sum + (d.value || 0), 0)

  return {
    pipeline: { count: pipelineDeals.length, value: sumValue(pipelineDeals) },
    won: { count: wonDeals.length, value: sumValue(wonDeals) },
  }
}

async function getRecentDeals(): Promise<(Deal & { company_name?: string })[]> {
  const { data } = await (supabase.from('deals') as any)
    .select('*, companies(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!data) return []

  return data.map((deal: any) => ({
    ...deal,
    company_name: deal.companies?.name,
  }))
}

async function getRecentActivities(): Promise<(Activity & { contact_name?: string; user_name?: string })[]> {
  const { data } = await (supabase.from('activities') as any)
    .select('*, contacts(first_name, last_name), user:user_id(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!data) return []

  return data.map((activity: any) => ({
    ...activity,
    contact_name: activity.contacts
      ? `${activity.contacts.first_name} ${activity.contacts.last_name}`
      : undefined,
    user_name: activity.user?.name,
  }))
}

async function getLeadData(): Promise<LeadData[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const { data } = await (supabase.from('contacts') as any)
    .select('id, lead_source, created_at, lifecycle_stage')
    .gte('created_at', twelveMonthsAgo.toISOString())
    .order('created_at', { ascending: false })

  return data || []
}

export default async function Dashboard() {
  const [pipelineStats, recentDeals, recentActivities, leadData] = await Promise.all([
    getPipelineStats(),
    getRecentDeals(),
    getRecentActivities(),
    getLeadData(),
  ])

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto pt-12 md:pt-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">Dashboard</h1>

        {/* Pipeline Summary */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Pipeline Overview</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-5 text-white">
              <p className="text-xs font-medium text-slate-300 uppercase tracking-wide mb-1">Pipeline Value</p>
              <p className="text-3xl font-semibold">
                {formatCurrency(pipelineStats.pipeline.value)}
              </p>
              <p className="text-sm text-slate-300 mt-1">
                {pipelineStats.pipeline.count} {pipelineStats.pipeline.count === 1 ? 'deal' : 'deals'} in progress
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg p-5 text-white">
              <p className="text-xs font-medium text-emerald-200 uppercase tracking-wide mb-1">Won Deals</p>
              <p className="text-3xl font-semibold">
                {formatCurrency(pipelineStats.won.value)}
              </p>
              <p className="text-sm text-emerald-200 mt-1">
                {pipelineStats.won.count} {pipelineStats.won.count === 1 ? 'deal' : 'deals'} closed
              </p>
            </div>
          </div>
        </section>

        {/* Lead Analytics */}
        <LeadAnalytics leads={leadData} />

        <div className="grid md:grid-cols-2 gap-8">
          {/* Recent Deals */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Deals</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {recentDeals.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No deals yet</p>
              ) : (
                recentDeals.map((deal) => (
                  <div key={deal.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{deal.title}</p>
                        {deal.company_name && (
                          <p className="text-sm text-gray-500 mt-1">{deal.company_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {deal.value ? formatCurrency(deal.value) : '-'}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${STAGE_COLORS[deal.stage]}`}
                        >
                          {STAGE_LABELS[deal.stage]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recent Activities */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {recentActivities.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No recent activity</p>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{activity.title}</p>
                        {activity.contact_name && (
                          <p className="text-sm text-gray-500">{activity.contact_name}</p>
                        )}
                        {activity.user_name && (
                          <p className="text-xs text-gray-400">by {activity.user_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {formatDate(activity.created_at)}
                        </p>
                        <span className="text-xs font-medium text-gray-600 capitalize">
                          {activity.activity_type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
