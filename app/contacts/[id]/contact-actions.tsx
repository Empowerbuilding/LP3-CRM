'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Contact, Company, LeadSource, ClientType } from '@/lib/types'
import { CreateDealModal } from './create-deal-modal'
import { CreateTaskModal } from '@/components/create-task-modal'

const LEAD_SOURCES: LeadSource[] = [
  'website_estimate',
  'phone_call',
  'referral',
  'facebook_ad',
  'email',
  'calendar_booking',
  'other',
]

const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website_estimate: 'Website Estimate',
  google_ads: 'Google Ads',
  referral: 'Referral',
  facebook_ad: 'Facebook Ad',
  phone_call: 'Direct Phone Call',
  email: 'Direct Email',
  storm_lead: 'Storm Lead',
  other: 'Other',
  calendar_booking: 'Calendar Booking',
  door_knock: 'Door Knock',
  insurance_adjuster: 'Insurance Adjuster',
  repeat_customer: 'Repeat Customer',
  yard_sign: 'Yard Sign',
}

const CLIENT_TYPES: ClientType[] = [
  'consumer',
  'builder',
  'subcontractor',
  'engineer',
  'architect',
  'realtor',
]

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
  realtor: 'Realtor',
}

interface ContactActionsProps {
  contact: Contact
  companies: Pick<Company, 'id' | 'name' | 'type'>[]
}

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  company_id: string
  lead_source: LeadSource | ''
  client_type: ClientType | ''
  is_primary: boolean
}

export function ContactActions({ contact, companies }: ContactActionsProps) {
  const router = useRouter()
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [dealModalOpen, setDealModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    role: contact.role ?? '',
    company_id: contact.company_id ?? '',
    lead_source: contact.lead_source ?? '',
    client_type: contact.client_type ?? '',
    is_primary: contact.is_primary,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role || null,
        company_id: formData.company_id || null,
        lead_source: formData.lead_source || null,
        client_type: formData.client_type || null,
        is_primary: formData.is_primary,
      }

      const { error: updateError } = await (supabase.from('contacts') as any)
        .update(payload)
        .eq('id', contact.id)

      if (updateError) throw updateError

      router.refresh()
      setSlideOverOpen(false)
    } catch (err) {
      console.error('Failed to save contact:', err)
      setError('Failed to save contact. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) return

    setDeleting(true)
    try {
      const { error: deleteError } = await (supabase.from('contacts') as any)
        .delete()
        .eq('id', contact.id)

      if (deleteError) throw deleteError

      router.push('/contacts')
      router.refresh()
    } catch (err) {
      console.error('Failed to delete contact:', err)
      setError('Failed to delete contact. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setTaskModalOpen(true)}
          className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Create Task
        </button>
        <button
          onClick={() => setDealModalOpen(true)}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          Add to Pipeline
        </button>
        <button
          onClick={() => setSlideOverOpen(true)}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          Edit Contact
        </button>
      </div>

      <CreateTaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        contact={contact}
        contactOwnerId={contact.owner_id}
      />

      <CreateDealModal
        contact={contact}
        isOpen={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
      />

      {slideOverOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSlideOverOpen(false)}
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit Contact</h2>
              <button
                onClick={() => setSlideOverOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                  >
                    <option value="">No company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. Owner, Project Manager"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lead Source
                    </label>
                    <select
                      value={formData.lead_source}
                      onChange={(e) => setFormData({ ...formData, lead_source: e.target.value as LeadSource | '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                    >
                      <option value="">Select source</option>
                      {LEAD_SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {LEAD_SOURCE_LABELS[source]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Type
                    </label>
                    <select
                      value={formData.client_type}
                      onChange={(e) => setFormData({ ...formData, client_type: e.target.value as ClientType | '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                    >
                      <option value="">Select type</option>
                      {CLIENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {CLIENT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_primary"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                  />
                  <label htmlFor="is_primary" className="text-sm text-gray-700">
                    Primary contact for company
                  </label>
                </div>

              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSlideOverOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
