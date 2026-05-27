'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface MeetingTypeInfo {
  title: string
  description: string | null
  duration_minutes: number
  location_type: string
  custom_fields: CustomField[]
  brand_color: string
  logo_url: string | null
  timezone: string
}

interface CustomField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required: boolean
  options?: string[]
  placeholder?: string
}

interface TimeSlot {
  start: string
  end: string
  startFormatted: string
  endFormatted: string
  available?: boolean
  blockedReason?: 'busy' | 'meeting' | 'past' | 'notice'
}

interface AvailabilityResponse {
  meetingType: MeetingTypeInfo
  host: { name: string }
  date: string
  timezone: string
  slots: TimeSlot[]
  allSlots?: TimeSlot[]
  calendarConnected: boolean
}

interface BookingFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  notes: string
  customFields: Record<string, string>
}

interface BookedMeeting {
  id: string
  startTime: string
  endTime: string
  title: string
  hostName: string
  googleMeetLink: string | null
  timezone: string
  confirmationMessage: string | null
}

type PageState = 'loading' | 'calendar' | 'form' | 'confirmed' | 'error'

export default function BookingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const isEmbed = searchParams.get('embed') === 'true'

  // Post message to parent window (for embed mode)
  const postMessageToParent = useCallback((data: Record<string, unknown>) => {
    if (isEmbed && typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage(data, '*')
    }
  }, [isEmbed])

  // Send height updates to parent in embed mode
  const sendHeightUpdate = useCallback(() => {
    if (isEmbed && typeof document !== 'undefined') {
      const height = document.body.scrollHeight
      postMessageToParent({ type: 'lp3-booking-resize', height })
    }
  }, [isEmbed, postMessageToParent])

  // Send ready message and set up resize observer
  useEffect(() => {
    if (isEmbed && typeof window !== 'undefined') {
      // Send ready message
      const height = document.body.scrollHeight
      postMessageToParent({ type: 'lp3-booking-ready', height })

      // Set up resize observer
      const resizeObserver = new ResizeObserver(() => {
        sendHeightUpdate()
      })
      resizeObserver.observe(document.body)

      // Also listen for window resize
      window.addEventListener('resize', sendHeightUpdate)

      return () => {
        resizeObserver.disconnect()
        window.removeEventListener('resize', sendHeightUpdate)
      }
    }
  }, [isEmbed, postMessageToParent, sendHeightUpdate])

  // Save fbclid to localStorage if present in URL (for Facebook attribution)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const fbclid = urlParams.get('fbclid')
      if (fbclid) {
        localStorage.setItem('fbclid', fbclid)
      }
    }
  }, [])

  // Page state
  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Meeting type info
  const [meetingType, setMeetingType] = useState<MeetingTypeInfo | null>(null)
  const [hostName, setHostName] = useState<string>('')
  const [calendarConnected, setCalendarConnected] = useState(true)

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [loadingDates, setLoadingDates] = useState(true)

  // Selected date and slots
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Timezone
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'America/Chicago'
    }
  })

  // Selected slot
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  // Mobile step: 'calendar' or 'times' (only used on mobile)
  const [mobileStep, setMobileStep] = useState<'calendar' | 'times'>('calendar')

  // Send height update when layout changes (for embed mode)
  useEffect(() => {
    // Small delay to allow DOM to update after state change
    const timer = setTimeout(() => {
      sendHeightUpdate()
    }, 50)
    return () => clearTimeout(timer)
  }, [mobileStep, pageState, selectedDate, sendHeightUpdate])

  // Booking form
  const [formData, setFormData] = useState<BookingFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    customFields: {},
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Booked meeting
  const [bookedMeeting, setBookedMeeting] = useState<BookedMeeting | null>(null)

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = []

    // Previous month padding
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i
      const date = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date, day, isCurrentMonth: false })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date, day, isCurrentMonth: true })
    }

    // Next month padding
    const remainingDays = 42 - days.length // 6 rows * 7 days
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    for (let day = 1; day <= remainingDays; day++) {
      const date = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date, day, isCurrentMonth: false })
    }

    return days
  }, [currentMonth])

  const monthYearLabel = useMemo(() => {
    const date = new Date(currentMonth.year, currentMonth.month, 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [currentMonth])

  const today = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  // Fetch initial data and available dates
  useEffect(() => {
    async function fetchInitialData() {
      setLoadingDates(true)
      try {
        const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`
        const res = await fetch(
          `/api/calendar/available-dates?slug=${slug}&month=${monthStr}&timezone=${encodeURIComponent(timezone)}`
        )

        if (res.status === 404) {
          setErrorMessage('Meeting type not found')
          setPageState('error')
          return
        }

        const data = await res.json()
        if (data.error) {
          setErrorMessage(data.error)
          setPageState('error')
          return
        }

        setAvailableDates(data.dates || [])

        // If we don't have meeting type info yet, fetch it
        if (!meetingType && data.dates?.length > 0) {
          const firstAvailableDate = data.dates[0]
          const slotRes = await fetch(
            `/api/calendar/availability?slug=${slug}&date=${firstAvailableDate}&timezone=${encodeURIComponent(timezone)}`
          )
          const slotData: AvailabilityResponse = await slotRes.json()

          if (slotData.meetingType) {
            setMeetingType(slotData.meetingType)
            setHostName(slotData.host?.name || 'Host')
            setCalendarConnected(slotData.calendarConnected !== false)
          }
        } else if (!meetingType) {
          // Fetch any date to get meeting type info
          const todayStr = today
          const slotRes = await fetch(
            `/api/calendar/availability?slug=${slug}&date=${todayStr}&timezone=${encodeURIComponent(timezone)}`
          )
          const slotData: AvailabilityResponse = await slotRes.json()

          if (slotData.meetingType) {
            setMeetingType(slotData.meetingType)
            setHostName(slotData.host?.name || 'Host')
            setCalendarConnected(slotData.calendarConnected !== false)
          }
        }

        setPageState('calendar')
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setErrorMessage('Failed to load availability')
        setPageState('error')
      } finally {
        setLoadingDates(false)
      }
    }

    fetchInitialData()
  }, [slug, currentMonth, timezone, meetingType, today])

  // Fetch slots when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setSlots([])
      return
    }

    async function fetchSlots() {
      setLoadingSlots(true)
      try {
        const res = await fetch(
          `/api/calendar/availability?slug=${slug}&date=${selectedDate}&timezone=${encodeURIComponent(timezone)}`
        )
        const data: AvailabilityResponse = await res.json()

        if (data.meetingType) {
          setMeetingType(data.meetingType)
          setHostName(data.host?.name || 'Host')
        }

        // Use allSlots if available (includes blocked slots), otherwise fall back to slots
        setSlots(data.allSlots || data.slots || [])
      } catch (err) {
        console.error('Failed to fetch slots:', err)
        setSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [slug, selectedDate, timezone])

  function navigateMonth(delta: number) {
    setCurrentMonth((prev) => {
      let newMonth = prev.month + delta
      let newYear = prev.year

      if (newMonth < 0) {
        newMonth = 11
        newYear--
      } else if (newMonth > 11) {
        newMonth = 0
        newYear++
      }

      return { year: newYear, month: newMonth }
    })
    setSelectedDate(null)
    setSlots([])
  }

  function selectDate(date: string) {
    setSelectedDate(date)
    setSelectedSlot(null)
    setMobileStep('times') // Switch to time slots on mobile
  }

  function goBackToMobileCalendar() {
    setMobileStep('calendar')
    setSelectedDate(null)
    setSlots([])
  }

  function selectSlot(slot: TimeSlot) {
    setSelectedSlot(slot)
    setPageState('form')
  }

  function goBackToCalendar() {
    setSelectedSlot(null)
    setPageState('calendar')
    setFormError(null)
  }

  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot || !meetingType) return

    setFormError(null)

    // Validate required fields
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setFormError('Please fill in all required fields')
      return
    }

    // Validate custom required fields
    for (const field of meetingType.custom_fields || []) {
      if (field.required && !formData.customFields[field.label]?.trim()) {
        setFormError(`Please fill in "${field.label}"`)
        return
      }
    }

    setSubmitting(true)

    // Get Facebook tracking data for CAPI attribution
    const getFbclid = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const fbclid = urlParams.get('fbclid')
      if (fbclid) return fbclid
      // Try localStorage fallback (may have been saved on landing page)
      return localStorage.getItem('fbclid') || undefined
    }

    const getFbp = () => {
      const match = document.cookie.match(/_fbp=([^;]+)/)
      return match ? match[1] : undefined
    }

    try {
      const res = await fetch('/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          startTime: selectedSlot.start,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          customFields: formData.customFields,
          timezone,
          source: 'website',
          fbclid: getFbclid(),
          fbp: getFbp(),
          client_user_agent: navigator.userAgent,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to book meeting')
      }

      setBookedMeeting(data.meeting)
      setPageState('confirmed')

      // Notify parent window in embed mode
      postMessageToParent({
        type: 'barnhaus-booking-complete',
        meeting: data.meeting,
      })
    } catch (err) {
      console.error('Booking failed:', err)
      setFormError(err instanceof Error ? err.message : 'Failed to book meeting')
    } finally {
      setSubmitting(false)
    }
  }

  function formatSelectedDate(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  function formatBookedTime(isoString: string) {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    })
  }

  const brandColor = meetingType?.brand_color || '#2d3748'

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className={`flex items-center justify-center ${isEmbed ? 'min-h-[400px] bg-white' : 'min-h-screen bg-gray-50'}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className={`flex items-center justify-center ${isEmbed ? 'min-h-[400px] bg-white p-4' : 'min-h-screen bg-gray-50'}`}>
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {errorMessage || 'Something went wrong'}
          </h1>
          <p className="text-gray-600">Please check the URL or try again later.</p>
        </div>
      </div>
    )
  }

  // Confirmation state
  if (pageState === 'confirmed' && bookedMeeting) {
    return (
      <div className={`flex items-center justify-center ${isEmbed ? 'bg-white p-4' : 'min-h-screen bg-gray-50 p-4'}`}>
        <div className={`bg-white rounded-xl max-w-md w-full p-8 text-center ${isEmbed ? '' : 'shadow-lg'}`}>
          <div
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: brandColor }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">You&apos;re booked!</h1>
          <p className="text-gray-600 mb-6">
            A calendar invitation has been sent to your email.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
            <h2 className="font-medium text-gray-900 mb-3">{bookedMeeting.title}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-700">{formatBookedTime(bookedMeeting.startTime)}</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-gray-700">{bookedMeeting.hostName}</span>
              </div>
              {bookedMeeting.googleMeetLink && (
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <a
                    href={bookedMeeting.googleMeetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Join Google Meet
                  </a>
                </div>
              )}
            </div>
          </div>

          {bookedMeeting.confirmationMessage && (
            <p className="text-gray-600 text-sm">{bookedMeeting.confirmationMessage}</p>
          )}
        </div>
      </div>
    )
  }

  // Booking form state
  if (pageState === 'form' && selectedSlot && meetingType) {
    return (
      <div className={isEmbed ? 'bg-white p-4' : 'min-h-screen bg-gray-50 p-4 md:p-8'}>
        <div className="max-w-lg mx-auto">
          {/* Back button */}
          <button
            onClick={goBackToCalendar}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className={`bg-white rounded-xl overflow-hidden ${isEmbed ? 'border border-gray-200' : 'shadow-lg'}`}>
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-xl font-semibold text-gray-900 mb-1">{meetingType.title}</h1>
              <p className="text-gray-600">
                {formatSelectedDate(selectedDate!)} at {selectedSlot.startFormatted}
              </p>
              <p className="text-sm text-gray-500">{meetingType.duration_minutes} minutes with {hostName}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitBooking} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              {/* Custom fields */}
              {meetingType.custom_fields?.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData.customFields[field.label] || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customFields: { ...formData.customFields, [field.label]: e.target.value },
                        })
                      }
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={formData.customFields[field.label] || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customFields: { ...formData.customFields, [field.label]: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={formData.customFields[field.label] || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customFields: { ...formData.customFields, [field.label]: e.target.value },
                        })
                      }
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Anything you'd like us to know beforehand?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Calendar view (default)
  return (
    <div className={isEmbed ? 'bg-white' : 'min-h-screen bg-gray-100'}>
      <div className={`max-w-4xl mx-auto ${isEmbed ? 'p-2' : 'p-4 md:p-8'}`}>
        <div className={`bg-white rounded-xl overflow-hidden ${isEmbed ? '' : 'shadow-lg'}`}>
          <div className="flex flex-col md:flex-row">
            {/* Left Panel - Calendar (hidden on mobile when viewing times) */}
            <div
              className={`p-5 md:w-1/2 ${mobileStep === 'times' ? 'hidden md:block' : ''}`}
              style={{ backgroundColor: brandColor }}
            >
              {/* Logo */}
              <div className="mb-8 flex justify-center">
                {meetingType?.logo_url ? (
                  <img
                    src={meetingType.logo_url}
                    alt="Logo"
                    className="max-w-[180px] max-h-[80px] object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center">
                    <span className="text-2xl font-light tracking-[0.25em] text-white">
                      MODERN<span style={{ color: '#8B7355' }}>DWELLINGS</span>
                    </span>
                  </div>
                )}
              </div>

              <h1 className="text-xl font-semibold text-white mb-1">
                Meet with {hostName || 'Host'}
              </h1>
              {meetingType && (
                <p className="text-white/80 text-sm mb-6">{meetingType.title}</p>
              )}

              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-white font-medium">{monthYearLabel}</span>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                  <div key={day} className="text-center text-xs text-white/60 py-2">
                    {day}
                  </div>
                ))}

                {/* Days */}
                {calendarDays.map(({ date, day, isCurrentMonth }, index) => {
                  const isAvailable = availableDates.includes(date)
                  const isPast = date < today
                  const isSelected = date === selectedDate
                  const isClickable = isCurrentMonth && isAvailable && !isPast

                  return (
                    <button
                      key={index}
                      onClick={() => isClickable && selectDate(date)}
                      disabled={!isClickable}
                      className={`
                        aspect-square flex items-center justify-center text-sm rounded-full transition-colors
                        ${!isCurrentMonth ? 'text-white/20' : ''}
                        ${isCurrentMonth && !isAvailable ? 'text-white/40' : ''}
                        ${isCurrentMonth && isPast ? 'text-white/30' : ''}
                        ${isClickable ? 'text-white hover:bg-white/20 cursor-pointer' : 'cursor-default'}
                        ${isSelected ? 'bg-white text-gray-900 font-medium' : ''}
                      `}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {loadingDates && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Right Panel - Time Slots (hidden on mobile when viewing calendar) */}
            <div className={`p-5 md:w-1/2 bg-white ${mobileStep === 'calendar' ? 'hidden md:block' : ''}`}>
              {/* Mobile back button */}
              <button
                onClick={goBackToMobileCalendar}
                className="md:hidden flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 -mt-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to calendar</span>
              </button>

              {meetingType && (
                <div className="mb-4">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Meeting duration</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {meetingType.duration_minutes} mins
                    </span>
                  </div>
                </div>
              )}

              {/* Mobile: Show selected date prominently */}
              {selectedDate && (
                <div className="md:hidden mb-4 pb-4 border-b border-gray-100">
                  <p className="text-sm text-gray-500">Selected date</p>
                  <p className="text-lg font-semibold text-gray-900">{formatSelectedDate(selectedDate)}</p>
                </div>
              )}

              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                What time works best?
              </h2>

              {/* Desktop: Show date context */}
              {selectedDate ? (
                <p className="hidden md:block text-sm text-gray-500 mb-4">
                  Showing times for {formatSelectedDate(selectedDate)}
                </p>
              ) : (
                <p className="hidden md:block text-sm text-gray-500 mb-4">
                  Select a date to see available times
                </p>
              )}

              {/* Timezone selector */}
              <div className="mb-4">
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Phoenix">Arizona Time (AZ)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>

              {/* Time slots */}
              {!calendarConnected ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Scheduling is temporarily unavailable.</p>
                  <p className="text-sm text-gray-500 mt-1">Please try again later.</p>
                </div>
              ) : loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
              ) : !selectedDate ? (
                <div className="hidden md:block text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>Select a date on the calendar</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No available times for this date.</p>
                  <p className="text-sm mt-1">Please select another date.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] sm:max-h-[500px] overflow-y-auto">
                  {slots.map((slot) => {
                    const isAvailable = slot.available !== false
                    const isBlocked = slot.blockedReason === 'busy' || slot.blockedReason === 'meeting'

                    if (!isAvailable && !isBlocked) {
                      // Don't show past/notice slots
                      return null
                    }

                    return (
                      <button
                        key={slot.start}
                        onClick={() => isAvailable && selectSlot(slot)}
                        disabled={!isAvailable}
                        className={`w-full py-3 px-4 text-left border rounded-lg transition-colors ${
                          isAvailable
                            ? 'border-gray-200 hover:border-brand-500 hover:bg-brand-50 group cursor-pointer'
                            : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${
                            isAvailable
                              ? 'text-gray-900 group-hover:text-brand-600'
                              : 'text-gray-400 line-through'
                          }`}>
                            {slot.startFormatted}
                          </span>
                          {!isAvailable && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Busy
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {meetingType?.description && !isEmbed && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-medium text-gray-900 mb-2">About this meeting</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{meetingType.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
