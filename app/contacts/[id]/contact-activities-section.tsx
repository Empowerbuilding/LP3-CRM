'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Activity, ActivityType, User } from '@/lib/types'

// Activity types that can be manually created by users
const MANUAL_ACTIVITY_TYPES: ActivityType[] = ['note', 'call', 'email_sent', 'sms_sent']

const ACTIVITY_TYPE_CONFIG: Partial<Record<ActivityType, { label: string; icon: JSX.Element; color: string }>> = {
  note: {
    label: 'Note',
    color: 'bg-gray-100 text-gray-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  call: {
    label: 'Call',
    color: 'bg-green-100 text-green-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  email_sent: {
    label: 'Email',
    color: 'bg-brand-100 text-brand-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  sms_sent: {
    label: 'SMS',
    color: 'bg-purple-100 text-purple-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  page_view: {
    label: 'Page View',
    color: 'bg-indigo-100 text-indigo-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  form_submit: {
    label: 'Form',
    color: 'bg-cyan-100 text-cyan-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  stage_change: {
    label: 'Stage Change',
    color: 'bg-yellow-100 text-yellow-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  deal_created: {
    label: 'Deal Created',
    color: 'bg-emerald-100 text-emerald-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  contact_created: {
    label: 'Contact Created',
    color: 'bg-teal-100 text-teal-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  meeting_scheduled: {
    label: 'Meeting',
    color: 'bg-brand-100 text-brand-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
}

interface ActivityWithUser extends Activity {
  user?: User | null
}

interface ContactActivitiesSectionProps {
  contactId: string
  activities: ActivityWithUser[]
  currentUserId?: string
}

// Format custom field key for display
function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

// Format custom field value for display
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && value >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value)
  }
  if (typeof value === 'number') return value.toLocaleString()
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function ContactActivitiesSection({ contactId, activities, currentUserId }: ContactActivitiesSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all')
  const [formData, setFormData] = useState({
    activity_type: 'note' as ActivityType,
    title: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  const filteredActivities = filterType === 'all'
    ? activities
    : activities.filter(a => a.activity_type === filterType)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // For notes, description is the content — use it as title if title is blank
    const isNote = formData.activity_type === 'note'
    const resolvedTitle = isNote && !formData.title.trim()
      ? formData.description.trim()
      : formData.title.trim()
    if (!resolvedTitle) return

    setSaving(true)
    try {
      const { error } = await (supabase.from('activities') as any).insert({
        contact_id: contactId,
        activity_type: formData.activity_type,
        title: resolvedTitle,
        description: isNote ? null : (formData.description.trim() || null),
        user_id: currentUserId || null,
      })

      if (error) throw error

      setFormData({ activity_type: 'note', title: '', description: '' })
      setShowForm(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to create activity:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-gray-900">Activity</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add Activity Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            {/* Type selector */}
            <div className="flex gap-1">
              {MANUAL_ACTIVITY_TYPES.map((type) => {
                const config = ACTIVITY_TYPE_CONFIG[type]
                if (!config) return null
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, activity_type: type })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.activity_type === type
                        ? config.color
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {config.icon}
                    <span className="hidden sm:inline">{config.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Title */}
            <input
              type="text"
              placeholder={formData.activity_type === "note" ? "Note title (optional)..." : `${ACTIVITY_TYPE_CONFIG[formData.activity_type]?.label || "Activity"} title...`}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
              autoFocus
            />

            {/* Description */}
            <textarea
              placeholder="Add details (optional)..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm resize-none"
            />

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || (!formData.title.trim() && !formData.description.trim())}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Add Activity'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter */}
      {activities.length > 0 && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({activities.length})
          </button>
          {Object.keys(ACTIVITY_TYPE_CONFIG).map((type) => {
            const activityType = type as ActivityType
            const config = ACTIVITY_TYPE_CONFIG[activityType]
            const count = activities.filter(a => a.activity_type === activityType).length
            if (count === 0 || !config) return null
            return (
              <button
                key={type}
                onClick={() => setFilterType(activityType)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === activityType
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {config.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Activity List */}
      {filteredActivities.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          {activities.length === 0
            ? 'No activity yet. Add a note or log a call.'
            : 'No activities match this filter.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((activity) => {
            const config = ACTIVITY_TYPE_CONFIG[activity.activity_type]

            return (
              <div
                key={activity.id}
                className="flex gap-3 p-3 rounded-lg border bg-white border-gray-200"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config?.color || 'bg-gray-100 text-gray-600'}`}>
                    {config?.icon || (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      {activity.description && (
                        <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">
                          {activity.description}
                        </p>
                      )}
                      {/* Show custom fields for meeting_scheduled activities */}
                      {(() => {
                        if (activity.activity_type !== 'meeting_scheduled' || !activity.metadata) return null
                        const metadata = activity.metadata as Record<string, unknown>
                        const customFields = metadata.custom_fields as Record<string, unknown> | undefined
                        const guestNotes = metadata.guest_notes as string | undefined
                        if (!customFields || Object.keys(customFields).length === 0) return null
                        return (
                          <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Form Responses</p>
                            <div className="space-y-0.5">
                              {Object.entries(customFields).map(([key, value]) => (
                                <div key={key} className="flex text-xs">
                                  <span className="text-gray-500 min-w-[100px]">{formatFieldLabel(key)}:</span>
                                  <span className="text-gray-900 font-medium">{formatFieldValue(value)}</span>
                                </div>
                              ))}
                            </div>
                            {guestNotes && (
                              <p className="text-xs text-gray-600 mt-1.5 pt-1.5 border-t border-gray-200">
                                <span className="text-gray-500">Notes:</span> {guestNotes}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                      <p className="text-xs text-gray-400 mt-1">
                        {activity.user?.name || 'System'}
                        {' · '}
                        {formatDateTime(activity.created_at)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${config?.color || 'bg-gray-100 text-gray-600'}`}>
                      {config?.label || activity.activity_type}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
