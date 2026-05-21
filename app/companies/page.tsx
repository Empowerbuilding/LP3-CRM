import { supabase } from '@/lib/supabase'
import type { Company, Contact, Deal } from '@/lib/types'
import { isDealWon } from '@/lib/types'
import { CompaniesTable } from './companies-table'

export const dynamic = 'force-dynamic'

export interface CompanyWithStats extends Company {
  primary_contact: string | null
  open_deals_count: number
  total_revenue: number
}

async function getCompaniesWithStats(): Promise<CompanyWithStats[]> {
  // Fetch companies
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name')
    .returns<Company[]>()

  if (!companies) return []

  // Fetch primary contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('company_id, first_name, last_name, is_primary')
    .eq('is_primary', true)
    .returns<Pick<Contact, 'company_id' | 'first_name' | 'last_name' | 'is_primary'>[]>()

  // Fetch deals for stats
  const { data: deals } = await supabase
    .from('deals')
    .select('company_id, stage, value')
    .returns<Pick<Deal, 'company_id' | 'stage' | 'value'>[]>()

  const contactsByCompany = new Map<string, string>()
  contacts?.forEach((c) => {
    if (c.company_id) {
      contactsByCompany.set(c.company_id, `${c.first_name} ${c.last_name}`)
    }
  })

  const dealStatsByCompany = new Map<string, { openCount: number; revenue: number }>()
  deals?.forEach((d) => {
    if (d.company_id) {
      const stats = dealStatsByCompany.get(d.company_id) ?? { openCount: 0, revenue: 0 }

      // Won = contract_signed, job_in_progress, completed
      if (isDealWon(d.stage)) {
        stats.revenue += d.value ?? 0
      } else if (d.stage !== 'lost') {
        stats.openCount += 1
      }
      dealStatsByCompany.set(d.company_id, stats)
    }
  })

  return companies.map((company) => ({
    ...company,
    primary_contact: contactsByCompany.get(company.id) ?? null,
    open_deals_count: dealStatsByCompany.get(company.id)?.openCount ?? 0,
    total_revenue: dealStatsByCompany.get(company.id)?.revenue ?? 0,
  }))
}

export default async function CompaniesPage() {
  const companies = await getCompaniesWithStats()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        <CompaniesTable initialCompanies={companies} />
      </div>
    </main>
  )
}
