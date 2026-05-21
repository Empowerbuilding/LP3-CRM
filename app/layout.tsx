import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { createClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { AppProviders } from '@/components/app-providers'
import { QuickAddDealWrapper } from '@/components/quick-add-deal'
import { Sidebar } from '@/components/sidebar'
import type { User } from '@/lib/types'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LP3 Roofing CRM',
  description: 'LP3 Roofing CRM',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || ''

  // Check if this is a public booking page (no sidebar needed)
  const isBookingPage = pathname.startsWith('/book')

  const serverSupabase = await createClient()
  const { data: { user: supabaseUser } } = await serverSupabase.auth.getUser()

  // Fetch CRM user if authenticated
  let crmUser: User | null = null
  if (supabaseUser?.email) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', supabaseUser.email)
      .single()
    crmUser = data as User | null
  }

  // Show sidebar for authenticated users, except on booking pages
  const showSidebar = supabaseUser && !isBookingPage

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders initialUser={supabaseUser} initialCrmUser={crmUser}>
          {showSidebar ? (
            <QuickAddDealWrapper>
              <Sidebar />
              <div className="md:ml-16 lg:ml-56 min-h-screen">
                {children}
              </div>
            </QuickAddDealWrapper>
          ) : (
            children
          )}
        </AppProviders>
      </body>
    </html>
  )
}
