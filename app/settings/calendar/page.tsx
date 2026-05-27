'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { MeetingTypeForm } from '@/components/calendar/MeetingTypeForm'
import { UpcomingMeetings, ScheduledMeetingDisplay } from '@/components/calendar/UpcomingMeetings'

interface CalendarStatus {
  connected: boolean
  email?: string
  expiresAt?: string
  provider?: string
}

interface MeetingType {
  id: string
  slug: string
  title: string
  description: string | null
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  availability_start: string
  availability_end: string
  available_days: number[]
  timezone: string
  max_days_ahead: number
  min_notice_hours: number
  location_type: string
  custom_location: string | null
  custom_fields: any[]
  confirmation_message: string | null
  brand_color: string
  logo_url: string | null
  is_active: boolean
  created_at: string
}


const LOCATION_ICONS: Record<string, string> = {
  phone: '📞',
  google_meet: '🎥',
  in_person: '📍',
  custom: '📋',
}

const LOCATION_LABELS: Record<string, string> = {
  phone: 'Phone Call',
  google_meet: 'Google Meet',
  in_person: 'In Person',
  custom: 'Custom',
}

export default function CalendarSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { crmUser } = useAuth()
  const isAdmin = crmUser?.role === 'admin'

  // Calendar connection state
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  // Meeting types state
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([])
  const [loadingMeetingTypes, setLoadingMeetingTypes] = useState(true)

  // Upcoming meetings state
  const [upcomingMeetings, setUpcomingMeetings] = useState<ScheduledMeetingDisplay[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(true)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Meeting type form state
  const [formOpen, setFormOpen] = useState(false)
  const [editingMeetingType, setEditingMeetingType] = useState<MeetingType | null>(null)

  // Check for URL params (connection result)
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === 'true') {
      setToast({ message: 'Google Calendar connected successfully!', type: 'success' })
      // Clear URL params
      window.history.replaceState({}, '', '/settings/calendar')
    } else if (error) {
      setToast({ message: `Connection failed: ${error}`, type: 'error' })
      window.history.replaceState({}, '', '/settings/calendar')
    }
  }, [searchParams])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Load calendar status
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch('/api/calendar/status')
        const data = await res.json()
        setCalendarStatus(data)
      } catch (err) {
        console.error('Failed to load calendar status:', err)
        setCalendarStatus({ connected: false })
      } finally {
        setLoadingStatus(false)
      }
    }
    loadStatus()
  }, [])

  // Load meeting types via API (uses service role to bypass RLS)
  const loadMeetingTypes = useCallback(async () => {
    if (!crmUser) return

    try {
      const res = await fetch('/api/meeting-types')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load meeting types')
      }

      setMeetingTypes(data.meetingTypes || [])
    } catch (err) {
      console.error('Failed to load meeting types:', err)
    } finally {
      setLoadingMeetingTypes(false)
    }
  }, [crmUser])

  useEffect(() => {
    loadMeetingTypes()
  }, [loadMeetingTypes])

  // Load upcoming meetings via API (uses service role to bypass RLS)
  useEffect(() => {
    async function loadUpcomingMeetings() {
      if (!crmUser) return

      try {
        const res = await fetch('/api/meetings?upcoming=true&status=scheduled&limit=5')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load meetings')
        }

        setUpcomingMeetings(data.meetings || [])
      } catch (err) {
        console.error('Failed to load upcoming meetings:', err)
      } finally {
        setLoadingMeetings(false)
      }
    }
    loadUpcomingMeetings()
  }, [crmUser])

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        setCalendarStatus({ connected: false })
        setShowDisconnectConfirm(false)
        setToast({ message: 'Google Calendar disconnected', type: 'success' })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('Failed to disconnect:', err)
      setToast({ message: 'Failed to disconnect calendar', type: 'error' })
    } finally {
      setDisconnecting(false)
    }
  }

  function openCreateForm() {
    setEditingMeetingType(null)
    setFormOpen(true)
  }

  function openEditForm(meetingType: MeetingType) {
    setEditingMeetingType(meetingType)
    setFormOpen(true)
  }

  function handleFormSaved() {
    loadMeetingTypes()
    setToast({ message: editingMeetingType ? 'Meeting type updated!' : 'Meeting type created!', type: 'success' })
  }

  async function handleCopyLink(slug: string) {
    const url = `https://crm.lp3rc.com/book/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setToast({ message: 'Link copied to clipboard!', type: 'success' })
    } catch (err) {
      console.error('Failed to copy:', err)
      setToast({ message: 'Failed to copy link', type: 'error' })
    }
  }

  async function handleDeleteMeetingType(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return

    try {
      const res = await fetch(`/api/meeting-types/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete meeting type')
      }

      setMeetingTypes((prev) => prev.filter((mt) => mt.id !== id))
      setToast({ message: 'Meeting type deleted', type: 'success' })
    } catch (err) {
      console.error('Failed to delete meeting type:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete meeting type'
      setToast({ message, type: 'error' })
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/meeting-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status')
      }

      setMeetingTypes((prev) =>
        prev.map((mt) => (mt.id === id ? { ...mt, is_active: !currentStatus } : mt))
      )
      setToast({
        message: `Meeting type ${!currentStatus ? 'activated' : 'deactivated'}`,
        type: 'success',
      })
    } catch (err) {
      console.error('Failed to toggle status:', err)
      setToast({ message: 'Failed to update status', type: 'error' })
    }
  }

  if (!crmUser) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pt-14 md:pt-6">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {toast.message}
          </div>
        )}

        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => router.push('/settings')}
              className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
            >
              Profile
            </button>
            <button
              className="pb-3 text-sm font-medium border-b-2 border-brand-600 text-brand-600 transition-colors"
            >
              Calendar
            </button>
            <button
              onClick={() => router.push('/settings/integrations')}
              className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
            >
              Integrations
            </button>
            {isAdmin && (
              <button
                onClick={() => router.push('/settings?tab=team')}
                className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
              >
                Team
              </button>
            )}
          </nav>
        </div>

        {/* Google Calendar Connection Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Google Calendar Connection</h2>

          {loadingStatus ? (
            <p className="text-sm text-gray-500">Checking connection status...</p>
          ) : calendarStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Connected</p>
                  <p className="text-sm text-gray-500">{calendarStatus.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Connect your Google Calendar to enable meeting scheduling. This allows guests to book
                meetings based on your availability.
              </p>
              <a
                href="/api/calendar/connect"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm.14 19.018c-3.868 0-7-3.14-7-7.018c0-3.878 3.132-7.018 7-7.018c1.89 0 3.47.697 4.682 1.829l-1.974 1.978v-.004c-.735-.702-1.667-1.062-2.708-1.062c-2.31 0-4.187 1.956-4.187 4.273c0 2.315 1.877 4.277 4.187 4.277c2.096 0 3.522-1.202 3.816-2.852H12.14v-2.737h6.585c.088.47.135.96.135 1.474c0 4.01-2.677 6.86-6.72 6.86z"/>
                </svg>
                Connect Google Calendar
              </a>
            </div>
          )}
        </div>

        {/* Disconnect Confirmation Modal */}
        {showDisconnectConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Disconnect Calendar?</h3>
              <p className="text-sm text-gray-600 mb-4">
                This will disconnect your Google Calendar. Existing meetings will remain, but new
                bookings won&apos;t sync to your calendar until you reconnect.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Meeting Types Section */}
        {calendarStatus?.connected && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Meeting Types</h2>
              <button
                onClick={openCreateForm}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Meeting Type
              </button>
            </div>

            {loadingMeetingTypes ? (
              <p className="text-sm text-gray-500">Loading meeting types...</p>
            ) : meetingTypes.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-2">No meeting types yet</p>
                <p className="text-sm text-gray-500">
                  Create your first meeting type to start accepting bookings.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {meetingTypes.map((mt) => (
                  <div
                    key={mt.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900">{mt.title}</h3>
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            {mt.duration_minutes} mins
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              mt.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {mt.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <span>{LOCATION_ICONS[mt.location_type] || '📋'}</span>
                          <span>{LOCATION_LABELS[mt.location_type] || mt.location_type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-600 truncate max-w-xs">
                            /book/{mt.slug}
                          </code>
                          <button
                            onClick={() => handleCopyLink(mt.slug)}
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                          >
                            Copy Link
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(mt.id, mt.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            mt.is_active
                              ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                          }`}
                          title={mt.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {mt.is_active ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => openEditForm(mt)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteMeetingType(mt.id, mt.title)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Embed Widget Section */}
        {calendarStatus?.connected && meetingTypes.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Embed on Your Website</h2>
            <p className="text-sm text-gray-600 mb-4">
              Add your booking page to any website using these embed options:
            </p>

            <div className="space-y-4">
              {/* Direct Link */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Direct Link</h3>
                <p className="text-xs text-gray-500 mb-2">Share this link directly with clients:</p>
                <code className="block text-xs bg-gray-50 p-3 rounded-lg text-gray-700 overflow-x-auto">
                  https://crm.lp3rc.com/book/{meetingTypes[0]?.slug || 'your-slug'}
                </code>
              </div>

              {/* Popup Button */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Popup Button</h3>
                <p className="text-xs text-gray-500 mb-2">Opens booking in a modal overlay:</p>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg text-gray-700 overflow-x-auto whitespace-pre-wrap">
{`<script src="https://crm.lp3rc.com/booking-widget.js"></script>
<button onclick="LP3RoofingBooking.open('${meetingTypes[0]?.slug || 'your-slug'}')">
  Schedule a Call
</button>`}
                </pre>
              </div>

              {/* Inline Embed */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Inline Embed</h3>
                <p className="text-xs text-gray-500 mb-2">Embed directly in your page:</p>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg text-gray-700 overflow-x-auto whitespace-pre-wrap">
{`<div id="booking-container"></div>
<script src="https://crm.lp3rc.com/booking-widget.js"></script>
<script>
  LP3RoofingBooking.render('${meetingTypes[0]?.slug || 'your-slug'}', '#booking-container');
</script>`}
                </pre>
              </div>

              {/* Advanced Options */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Advanced Options</h3>
                <p className="text-xs text-gray-500 mb-2">Callbacks for booking events:</p>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg text-gray-700 overflow-x-auto whitespace-pre-wrap">
{`LP3RoofingBooking.open('${meetingTypes[0]?.slug || 'your-slug'}', {
  onBooked: function(meeting) {
    console.log('Booked:', meeting);
    // Track conversion, show thank you, etc.
  },
  onClose: function() {
    console.log('Modal closed');
  }
});`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Meetings Section */}
        {calendarStatus?.connected && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Upcoming Meetings</h2>
              <Link
                href="/meetings"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                View All
              </Link>
            </div>

            {loadingMeetings ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
              </div>
            ) : (
              <UpcomingMeetings
                meetings={upcomingMeetings}
                compact={true}
                emptyMessage="No upcoming meetings scheduled"
              />
            )}
          </div>
        )}
      </div>

      {/* Meeting Type Form */}
      <MeetingTypeForm
        meetingType={editingMeetingType}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleFormSaved}
      />
    </main>
  )
}
